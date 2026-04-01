# Remove Cloudflare Access from App Code

## Context

The admin UI (`/_/admin/*`) is protected by Cloudflare Access, which enforces authentication at the edge before requests reach the worker. The app should not duplicate or depend on this: it should behave as completely unauthenticated for admin routes. Access control is the deployer's responsibility (CF Access, IP restrictions, private tunnels, etc.).

The app currently reads the `Cf-Access-Jwt-Assertion` JWT header to extract user identity (email), then uses that identity to scope API keys, preferences, and UI display. This coupling must be removed.

**What stays:** API key authentication for the public API (`/_/api/*`), SDK, and MCP endpoint. That is the only auth the app implements.

**What changes:**
- All CF Access header reading, JWT decoding, and identity extraction: removed
- API keys become ownerless (no email column, all admins manage all keys)
- User preferences (theme, language): moved to browser cookies (no server-side storage)
- SDK `AccessTokenAuth` type: removed
- UI: no email display, no sign-out link

## Decisions

- **Tests:** Rewrite tests that assert per-user isolation to match the new ownerless/global behavior. This is authorized as an intentional behavior change, not a code-accommodation hack.
- **Preferences:** Browser cookies only. Theme and language stored as cookies (`theme`, `lang`). Server reads cookies for SSR. No database table needed.

---

## Implementation Steps

### 1. Database migration

- [x]Create `migrations/0004_remove_auth_scoping.sql`
  - Recreate `api_keys` table without `email` column (D1 lacks `ALTER TABLE DROP COLUMN`):
    ```sql
    CREATE TABLE api_keys_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      scope TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    );
    INSERT INTO api_keys_new (id, title, key_prefix, key_hash, scope, created_at, last_used_at)
      SELECT id, title, key_prefix, key_hash, scope, created_at, last_used_at FROM api_keys;
    DROP TABLE api_keys;
    ALTER TABLE api_keys_new RENAME TO api_keys;
    CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
    ```
  - Drop the `user_preferences` table:
    ```sql
    DROP TABLE IF EXISTS user_preferences;
    ```

### 2. Core auth module (`src/auth.ts`)

- [x]Remove `Identity` type, `ANONYMOUS_IDENTITY`, `getIdentity()`, `decodeJwtPayload()`
- [x]Keep `unauthorizedResponse()` (used by API key auth)

After:
```typescript
export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
```

### 3. Database layer (`src/db.ts`)

- [x]`ApiKeyRow`: remove `email` field
- [x]`createApiKey(db, title, scope)`: remove `email` parameter, update INSERT SQL
- [x]Rename `getApiKeysByEmail` to `getAllApiKeys(db)`: return all keys, no email filter
- [x]`deleteApiKey(db, id)`: remove `email` parameter, delete by `id` only
- [x]`authenticateApiKey`: unchanged (lookup by hash), but returned row no longer has `email`
- [x]Delete `getUserPreference()`, `setUserPreference()`, `getUserPreferences()`

### 4. Service layer (`src/services/admin-management.ts`)

- [x]`listApiKeysForUser(env, email)` becomes `listAllApiKeys(env)`: no email param, calls `getAllApiKeys`
- [x]`createApiKeyForUser(env, email, body)` becomes `createNewApiKey(env, body)`: no email param
- [x]`deleteApiKeyForUser(env, email, id)` becomes `deleteApiKeyById(env, id)`: no email param
- [x]Delete `getUserPreferencesForUser()` and `updateUserPreferences()`
- [x]Remove `setUserPreference` and `getUserPreferences` imports from `../db`

### 5. API handlers

#### `src/api/keys.ts`
- [x]`handleListKeys(env)`: remove `email` parameter
- [x]`handleCreateKey(request, env)`: remove `email` parameter
- [x]`handleDeleteKey(env, id)`: remove `email` parameter

#### `src/api/preferences.ts`
- [x]Delete this file entirely (preferences are now browser-side cookies)

### 6. Main router (`src/index.tsx`)

- [x]Remove imports: `getIdentity`, `Identity` from `./auth`; `getUserPreferences` from `./db`; preference handlers from `./api/preferences`
- [x]Remove `identity` from `HonoEnv.Variables` type
- [x]Remove admin identity middleware (lines 105-108):
  ```typescript
  // DELETE THIS:
  app.use("/_/admin/*", async (c, next) => {
    c.set("identity", getIdentity(c.req.raw));
    await next();
  });
  ```
- [x]Rewrite `getPageData()`: read theme and language from cookies instead of DB preferences. Add a cookie-parsing helper:
  ```typescript
  function getCookie(request: Request, name: string): string | null {
    const header = request.headers.get("Cookie") || "";
    const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  }
  ```
  `getPageData` becomes:
  ```typescript
  async function getPageData(c: { env: Env; req: { raw: Request } }) {
    const db = c.env.DB;
    const theme = getCookie(c.req.raw, "theme") || "oddbit";
    const lang = getCookie(c.req.raw, "lang") || "en";
    const t = createTranslateFn(lang);
    const translations = getTranslations(lang);
    const slugLengthStr = await getSetting(db, "slug_default_length");
    const slugLength = slugLengthStr ? parseInt(slugLengthStr, 10) : DEFAULT_SLUG_LENGTH;
    return { db, theme, slugLength, lang, t, translations };
  }
  ```
- [x]Update all admin page routes: remove `identity` destructuring, remove `displayName={identity.displayName}` from Layout
- [x]Update admin API key routes: remove `c.var.identity.id` parameter:
  ```typescript
  app.get("/_/admin/api/keys", (c) => handleListKeys(c.env));
  app.post("/_/admin/api/keys", (c) => handleCreateKey(c.req.raw, c.env));
  app.delete("/_/admin/api/keys/:id", (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
    return handleDeleteKey(c.env, id);
  });
  ```
- [x]Remove preferences routes entirely:
  ```typescript
  // DELETE THESE:
  app.get("/_/admin/api/preferences", ...);
  app.put("/_/admin/api/preferences", ...);
  ```
- [x]Simplify `AuthContext` type (remove `identity`):
  ```typescript
  type AuthContext = {
    source: "apikey";
    scope: string | null;
  };
  ```
- [x]Update `resolveAuth()`: don't set `identity` from key email:
  ```typescript
  async function resolveAuth(request: Request, env: Env): Promise<AuthContext | null> {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const key = await authenticateApiKey(env.DB, token);
      if (key) {
        return { source: "apikey", scope: key.scope };
      }
    }
    return null;
  }
  ```

### 7. UI: Layout (`src/pages/layout.tsx`)

- [x]Remove `displayName` prop from `LayoutProps`
- [x]Remove the sidebar user section (email display + sign-out link):
  ```tsx
  // DELETE THIS:
  <div class="sidebar-user">
    <div class="sidebar-user-email">{displayName}</div>
    <a href="/cdn-cgi/access/logout" class="sidebar-user-logout">
      {t("nav.signOut")}
    </a>
  </div>
  ```
- [x]Update `adminClientScript` call: remove `displayName` argument

### 8. Client script (`src/client.ts`)

- [x]Remove `email` parameter from `adminClientScript(version, translations)` function signature
- [x]Remove `CURRENT_USER` variable
- [x]Change `setTheme()` to use cookie instead of API:
  ```javascript
  function setTheme(theme) {
    applyTheme(theme);
    document.cookie = 'theme=' + theme + ';path=/;max-age=31536000;SameSite=Lax';
    toast(t('client.themeUpdated'));
  }
  ```
- [x]Change `setLanguage()` to use cookie instead of API:
  ```javascript
  function setLanguage(lang) {
    document.cookie = 'lang=' + lang + ';path=/;max-age=31536000;SameSite=Lax';
    window.location.reload();
  }
  ```

### 9. Styles (`src/styles.ts`)

- [x]Remove `.sidebar-user`, `.sidebar-user-email`, `.sidebar-user-logout` CSS rules
- [x]Remove `[data-theme="light"] .sidebar-user` rule

### 10. i18n

- [x]Remove `"nav.signOut"` key from `src/i18n/en.ts`, `src/i18n/id.ts`, `src/i18n/sv.ts`

### 11. SDK (`sdk/src/`)

#### `sdk/src/types.ts`
- [x]Remove `AccessTokenAuth` interface
- [x]Change `ShrtnrAuth` to just `ApiKeyAuth`:
  ```typescript
  export type ShrtnrAuth = ApiKeyAuth;
  ```

#### `sdk/src/base-client.ts`
- [x]Remove the CF Access JWT branch:
  ```typescript
  constructor(config: ShrtnrConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.headers = { Authorization: `Bearer ${config.auth.apiKey}` };
  }
  ```

### 12. Tests

#### `src/__tests__/setup.ts`
- [x]Remove `DELETE FROM user_preferences` from `resetData()`

#### `src/__tests__/auth.test.ts`
- [x]Remove all `getIdentity` tests (function no longer exists)
- [x]Keep `unauthorizedResponse` test
- [x]Remove `ANONYMOUS_IDENTITY` import

#### `src/__tests__/api.test.ts`
- [x]Remove `makeJwt()` helper (or keep it, it's harmless since server ignores the header)
- [x]Rewrite "should not include other users keys" test: after creating keys with one user's JWT, listing from another JWT should still return all keys
- [x]Rewrite "should not revoke another users key" test: any admin can delete any key, expect 200 instead of 404
- [x]Remove "preferences should be scoped per user" test (preferences API no longer exists)
- [x]Remove all preference API endpoint tests (GET/PUT `/_/admin/api/preferences`) since those endpoints are removed
- [x]Keep preference validation tests if they move to a different mechanism, otherwise remove

#### `src/__tests__/integration.test.ts`
- [x]Remove entire "User Preferences" describe block (table no longer exists)
- [x]In "API Keys" describe block:
  - Update `createApiKey` calls: remove email parameter
  - Remove `expect(key.email)` assertions
  - `getApiKeysByEmail` becomes `getAllApiKeys`: update calls
  - `deleteApiKey` calls: remove email parameter
  - Rewrite "should list keys for a specific user only": all keys are returned regardless
  - Rewrite "should not delete a key owned by a different user": deletion succeeds for any caller

#### `src/__tests__/admin-service.test.ts`
- [x]Update `createApiKeyForUser` calls to new signature (no email)
- [x]Update `updateUserPreferences` calls to remove email parameter, or remove preference tests if the service function is deleted
- [x]Rename function calls to match new names (`createNewApiKey`, `listAllApiKeys`, etc.)

#### `sdk/src/__tests__/client.test.ts`
- [x]Remove "should send Cf-Access-Jwt-Assertion header for access token auth" test
- [x]Change tests that use `{ accessToken: "jwt" }` to use `{ apiKey: "sk_test" }`

### 13. README and CHANGELOG

- [x]Update README: remove any mention of Cloudflare Access as a requirement for the admin UI
- [x]Update SDK documentation in README: remove `AccessTokenAuth` examples
- [x]Add CHANGELOG entry describing the breaking change

---

## Verification

1. Run `npm test` (or `vitest`): all tests pass
2. Run `npm run build` (or `wrangler build`): no type errors
3. Deploy locally with `wrangler dev`:
   - Admin UI loads without CF Access headers
   - Theme/language changes persist via cookies across page reloads
   - API keys can be created, listed, and deleted by any admin
   - Public API with Bearer token still works
   - MCP endpoint with Bearer token still works
4. Verify no remaining references to CF Access in source:
   ```bash
   grep -r "Cf-Access" src/ sdk/src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
   ```
   Should return no results.

## Files to modify

| File | Action |
|------|--------|
| `migrations/0004_remove_auth_scoping.sql` | Create |
| `src/auth.ts` | Gut (keep only `unauthorizedResponse`) |
| `src/db.ts` | Remove email from API keys, remove preferences |
| `src/services/admin-management.ts` | Remove email params, remove preferences |
| `src/api/keys.ts` | Remove email params |
| `src/api/preferences.ts` | Delete |
| `src/index.tsx` | Remove identity middleware, cookie-based prefs, simplify AuthContext |
| `src/pages/layout.tsx` | Remove displayName prop, user section |
| `src/client.ts` | Remove email, cookie-based theme/lang |
| `src/styles.ts` | Remove sidebar-user styles |
| `src/i18n/en.ts` | Remove nav.signOut |
| `src/i18n/id.ts` | Remove nav.signOut |
| `src/i18n/sv.ts` | Remove nav.signOut |
| `sdk/src/types.ts` | Remove AccessTokenAuth |
| `sdk/src/base-client.ts` | Remove CF Access branch |
| `src/__tests__/setup.ts` | Remove user_preferences cleanup |
| `src/__tests__/auth.test.ts` | Remove getIdentity tests |
| `src/__tests__/api.test.ts` | Rewrite isolation tests, remove preferences tests |
| `src/__tests__/integration.test.ts` | Remove preferences, rewrite key tests |
| `src/__tests__/admin-service.test.ts` | Update function signatures |
| `sdk/src/__tests__/client.test.ts` | Remove AccessToken test, update others |
