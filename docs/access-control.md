# Access control

shrtnr separates two questions. Cloudflare Access decides who may reach the admin pages and the MCP endpoint. shrtnr's ownership model decides what a signed-in identity may change once inside. API keys cover the third surface, the public REST API under `/_/api/*`.

## Protect the admin UI

The admin UI (`/_/admin/*`) ships without built-in authentication. Protecting it is your responsibility. The app makes no assumptions about which method you use. Cloudflare Access fits most deployments because it also supplies the per-user identity that the ownership model runs on. IP allowlists, firewall rules, Cloudflare Tunnel or a private network work too, but every request then arrives as the same anonymous identity, so ownership checks cannot tell users apart.

### Cloudflare Access

Cloudflare Access handles login, sessions and SSO at the edge before requests reach your Worker. It supports Google, GitHub, Microsoft, Okta, SAML, OIDC and a built-in one-time PIN.

1. Open **Zero Trust** in the [Cloudflare dashboard](https://one.dash.cloudflare.com/).
2. Go to **Access > Applications > Add an application**.
3. Choose **Self-hosted**.
4. Set the application domain to your short domain (for example `oddb.it`) with path `_/admin/*`.
5. Add a policy, for example:
   - **Action:** Allow
   - **Include rule:** Emails ending in `@yourcompany.com`
6. Under **Authentication**, enable at least one login method. "One-time PIN" works without an external identity provider.

Visit `https://yourdomain.com/_/admin` and Cloudflare Access prompts you to log in before the dashboard loads. See [Cloudflare's IdP guides](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/) for provider setup.

### JWT verification in the Worker

Without further configuration the Worker trusts whatever Cloudflare Access lets through, which is network-layer protection. For defense in depth, enable cryptographic JWT verification so the Worker validates every request on its own:

1. In Zero Trust, open your application's **Overview** tab and copy the **Application Audience (AUD) Tag**.
2. Store it as a Worker secret, together with the JWKS URL of your team:

```bash
npx wrangler secret put ACCESS_AUD
npx wrangler secret put ACCESS_JWKS_URL
```

`ACCESS_JWKS_URL` follows the pattern `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/certs`.

When `ACCESS_AUD` is set, the Worker validates the JWT signature and audience claim on every admin and MCP request. The key set downloads once per isolate and is reused. When `ACCESS_AUD` is absent, as in local development, the Worker skips verification and takes the identity from the `dev_identity` cookie or `DEV_IDENTITY` instead. See [Local sign-in](../README.md#local-sign-in).

## Where identity comes from

| Surface | Identity |
|---|---|
| Admin UI and admin API (`/_/admin/*`) | Email from the Cloudflare Access JWT, read from the `Cf-Access-Jwt-Assertion` header or the `CF_Authorization` cookie |
| MCP endpoint (`mcp.<your-domain>`) | Email from the Access JWT that Managed OAuth issues to the MCP client |
| Public API (`/_/api/*`) | The identity that created the API key. A key acts as its creator. |
| Local development (`ACCESS_AUD` unset) | The `dev_identity` cookie set by `/_/dev/login`, else `DEV_IDENTITY` from `.dev.vars`, else `anonymous` |

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

Ownership is a single column: `links.created_by` and `bundles.created_by`, set once at creation from the caller's identity and never reassigned. There is no transfer, no sharing and no admin override: a deployment-wide administrator who did not create a link cannot delete it either. A link created with no identity at all is stored as owner `anonymous`, which is also the identity every unidentified caller arrives with, so on a deployment without access control everyone shares that one bucket.

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
