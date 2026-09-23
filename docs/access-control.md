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

A Worker with a custom domain still answers on its `workers.dev` URL and on per-version preview URLs. The Worker's own check keeps the admin pages shut on any host whose Access application it does not know. To stop serving a host altogether, turn off `workers.dev` and Preview URLs under **Settings > Domains & Routes**. Alternatively, add `"workers_dev": false` and `"preview_urls": false` to `wrangler.jsonc` in your fork. The repository leaves both on, because a fresh one-click deploy has no other URL.

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

The table is what `src/services/link-management.ts` and `src/services/bundle-management.ts` enforce. The suite in `src/__tests__/service/ownership.test.ts` pins each row.

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

A link with recorded clicks cannot be deleted, by anyone. Disable it instead: every slug stops redirecting, the click history stays, and the owner can enable it again later. The same rule applies to slugs.

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
