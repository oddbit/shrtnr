# Access control

shrtnr separates two questions. Cloudflare Access decides who may reach the admin pages and the MCP endpoint. shrtnr's ownership model decides what a signed-in identity may change once inside. API keys cover the third surface, the public REST API under `/_/api/*`.

## Protect the admin UI

The admin UI (`/_/admin/*`) takes its identity from Cloudflare Access, and the Worker verifies the Access JWT on every request. Access handles login, sessions and SSO at the edge before a request reaches the Worker. It supports Google, GitHub, Microsoft, Okta, SAML, OIDC and a built-in one-time PIN, and the free plan covers up to 50 users.

Until the Worker has an Access audience tag to verify against, the admin pages stay shut. Every page answers a setup page that lists the steps below, and the admin API answers 503. Short links keep redirecting throughout. The Worker refuses rather than guesses because every other identity source is text any caller can write: an email header, an unsigned token, a cookie.

### 1. Put Access in front of the Worker

Pick the route that matches how visitors reach the Worker. A deployment that answers on both a `workers.dev` URL and a custom domain needs both.

**workers.dev URL, one click.** Go to **Workers & Pages**, select the Worker, open **Settings > Domains & Routes** and select **Enable Cloudflare Access** next to `workers.dev`. Cloudflare creates an Access application for the URL. Select **Manage Cloudflare Access** to choose who its policy admits.

**Custom domain, self-hosted application.**

1. Open **Zero Trust** in the [Cloudflare dashboard](https://one.dash.cloudflare.com/).
2. Go to **Access > Applications > Add an application**.
3. Choose **Self-hosted**.
4. Set the application domain to your short domain (for example `oddb.it`) with path `_/admin/*`.
5. Add a policy, for example:
   - **Action:** Allow
   - **Include rule:** Emails ending in `@yourcompany.com`
6. Under **Authentication**, enable at least one login method. "One-time PIN" works without an external identity provider.

See [Cloudflare's IdP guides](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/) for provider setup.

### 2. Give the Worker the audience tag

1. In Zero Trust, open each application's **Overview** tab and copy its **Application Audience (AUD) Tag**.
2. Store the tag and the JWKS URL of your team as Worker secrets:

```bash
npx wrangler secret put ACCESS_AUD
npx wrangler secret put ACCESS_JWKS_URL
```

`ACCESS_JWKS_URL` follows the pattern `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/certs`. When the Worker sits behind two applications, store both tags in `ACCESS_AUD`, separated by a comma. The dashboard route works as well: **Workers & Pages > shrtnr > Settings > Variables and Secrets**, type **Secret**.

Open `/_/admin/dashboard` and sign in through Access. The Worker validates the JWT signature and audience claim on every admin request. The key set downloads once per isolate and is reused.

### 3. Close the routes you do not use

A Worker with a custom domain still answers on its `workers.dev` URL. The Worker's own check keeps the admin pages shut on any host whose Access application it does not know. `wrangler.jsonc` ships with `"preview_urls": false`, so per-version preview URLs stay off; set it to `true` in your fork to preview branch builds. The repository leaves `workers_dev` unset, because a fresh one-click deploy has no other URL, and wrangler then turns `workers.dev` back on at every deploy even after you switch it off in the dashboard. Once a custom domain serves the Worker, either enable Access on `workers.dev` and add its AUD tag to `ACCESS_AUD`, or add `"workers_dev": false` to `wrangler.jsonc` in your fork.

### Which domain the links are handed out on

A deployment that answers on several domains hands out whichever one the operator opened the admin on: the copy button, the QR modal and the QR code all follow the request host. Set `SHORT_ORIGIN` to pin one instead:

```bash
npx wrangler secret put SHORT_ORIGIN   # c.example, or https://c.example
```

It takes a bare host or a full origin, and must not carry a path, a query string or credentials: short links live at the root, where the `/:slug` route is. Unset is the default and keeps the request origin, so a deployment that never sets it behaves as before. A value that is not a bare http(s) origin is ignored, the request origin is used instead, and the Worker logs a warning once per isolate.

The domain still has to be attached to the Worker and reachable: this setting changes which URL is handed out, it does not create the domain. Admin access is a separate question, so an operator can open the admin on one domain and hand out links on another. The identity behind every write still comes from whichever Access application covers the host the admin was opened on.

### Local development

`wrangler dev` runs without Access. `DEV_MODE=true` in `.dev.vars` tells the Worker it runs on a developer machine, and only then does it take the identity from the `dev_identity` cookie or `DEV_IDENTITY`. A deploy never uploads `.dev.vars`, and a configured `ACCESS_AUD` always wins over `DEV_MODE`. See [Local sign-in](../README.md#local-sign-in).

## Where identity comes from

| Surface | Identity |
|---|---|
| Admin UI and admin API (`/_/admin/*`) | Email from the Cloudflare Access JWT, read from the `Cf-Access-Jwt-Assertion` header or the `CF_Authorization` cookie |
| MCP endpoint (`mcp.<your-domain>`) | Email from the Access JWT that Managed OAuth issues to the MCP client |
| Public API (`/_/api/*`) | The identity that created the API key. A key acts as its creator. |
| Local development (`DEV_MODE=true`, `ACCESS_AUD` unset) | The `dev_identity` cookie set by `/_/dev/login`, else `DEV_IDENTITY` from `.dev.vars`, else `anonymous` |

## Permission model

Every link and bundle records the identity that created it. Reads are open to every authenticated identity. Writes that change or remove something belong to the creator. Two writes stay open to everyone on purpose, because they add without taking away: attaching a custom slug to a link, and adding a link to a bundle.

The table is what `src/services/link-management.ts` and `src/services/bundle-management.ts` enforce. The admin UI, the `/_/api/*` key path and the MCP endpoint all call that one service layer, so the rules hold identically on all three. `src/__tests__/service/ownership.test.ts` and `src/__tests__/service/authorization-model.test.ts` pin each row at the service; `src/__tests__/handler/authorization-surfaces.test.ts` pins the same answers through each of the three surfaces.

| Action | Who may do it |
|---|---|
| Read links, slugs, bundles and their analytics | Any authenticated identity |
| Create a link | Any authenticated identity. The creator becomes the owner. |
| Update a link's URL, label or expiry | Link owner |
| Disable or enable a link | Link owner |
| Delete a link | Link owner, and only while the link has zero clicks |
| Add a custom slug to a link | Any authenticated identity, owner or not |
| Set the primary slug, disable or enable a slug | Link owner |
| Remove a slug | Link owner, custom slugs only, and only while the slug has zero clicks |
| Create a bundle | Any authenticated identity. The creator becomes the owner. |
| Update, archive, unarchive or delete a bundle | Bundle owner |
| Add a link to a bundle | Any authenticated identity |
| Remove a link from a bundle | Bundle owner |
| Create or delete API keys | Each identity manages its own keys |
| Theme, language, default range, analytics filters, default slug length | Stored per identity |

The two open rows are a settled design decision, not an oversight: they let a colleague file your link into their campaign bundle, or hand it a memorable slug, without asking you first. Neither can redirect, disable or destroy anything.

A refused write answers `403` with a sentence naming the rule. A request for something that is not there answers `404`, so the two cases stay distinguishable. MCP reports a refusal as an error message rather than a status code, so an assistant sees the sentence, not the `403` or `400` behind it.

### Ownership

Ownership is a single column: `links.created_by` and `bundles.created_by`, set once at creation from the caller's identity and never reassigned. There is no transfer, no sharing and no admin override: a deployment-wide administrator who did not create a link cannot delete it either. A link created with no identity at all is stored as owner `anonymous`, which is also the identity an unidentified caller arrives with. A deployment verifies every admin and MCP request against Access and every API request against its key, and refuses the rest, so the shared bucket only appears in local dev mode.

### Delete only while unclicked, disable after that

A link can be deleted only while it has recorded zero clicks. The rule binds the owner too: a link with clicks cannot be deleted by anyone. The admin UI offers the owner exactly one of the two actions, delete at zero clicks and disable after the first, and the server refuses delete after that point on every surface. The count is lifetime and unfiltered: one click from a bot is enough. After that, delete answers `400` with `Cannot delete a link with clicks, disable it instead`, and disabling the link is the operation that works: every slug stops redirecting, the click history stays, and the owner can enable it again later.

The same rule protects a custom slug. Removing one answers `400` with `Cannot remove a slug with clicks, disable it instead` once it has recorded a click, and disabling that slug is the remedy: it stops that one slug resolving while the link's other slugs keep working, and its click history stays.

The reason is that a clicked short link exists in the wild. It is in sent email, in print, on a slide, inside a QR code on a sticker nobody can recall. Deleting it frees the slug for reuse and turns every one of those into a `404` or, worse, a redirect to whatever claims the slug next. Disabling keeps the row, keeps its click history, and stops the redirect. Removing a clicked slug would orphan or cascade away its click rows in the same way.

The system-generated slug is a special case. It can be neither removed nor disabled, whatever its click count, since it is the link's canonical address. Disable the whole link instead.

Bundles carry no click rule. A bundle is a grouping, not an address: deleting one removes memberships and leaves every member link and its history untouched. Archiving is the reversible alternative, which hides a bundle from the default listing without deleting anything.

### Scopes and ownership

Scopes are a separate gate, and only the API key path has them. A key is issued `read`, `create`, or both, and a `read` key is refused on every write with `403` before ownership is consulted. The admin UI and MCP have no scope split.

What the model does not do:

- **No roles or admin tier.** Every identity the Access policy admits has the same standing. Ownership is the only distinction.
- **No private links or bundles.** Any authenticated identity can read any link, bundle and analytics report, and can filter the links list by owner.
- **No read-only MCP audience.** Anyone the MCP Access policy admits can call every tool, subject to the ownership rules above. See [MCP server](mcp.md#authorization-model).
- **Ownership is the identity string.** The check compares the stored creator with the caller's email, character for character. An identity whose email changes in the identity provider no longer owns what the old address created.

## API keys

API keys authenticate the public REST API. Create them in the admin UI under **API Keys**. The Worker stores a hash of the key and its prefix, and records when each key was last used.

Each key carries one or both of two scopes:

| Scope | Grants |
|---|---|
| `read` | Every `GET` route: list and look up links, slugs and bundles, read analytics, timelines, breakdowns and QR codes |
| `create` | Every `POST`, `PUT` and `DELETE` route: create, update, disable, enable and delete links, manage slugs, manage bundles and their membership |

A key acts as the identity that created it. Links and bundles created through the key record that identity as their owner, and the ownership rules apply to the key exactly as they apply to a signed-in user in the admin UI. A `create` key cannot disable or delete another user's links.

Pass the key as a bearer token:

```
Authorization: Bearer sk_...
```
