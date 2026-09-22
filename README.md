![SHRTNR. logotype](./public/logotype-white.svg)
# Open-Source URL Shortener on Cloudflare Workers

[![npm](https://img.shields.io/npm/v/%40oddbit%2Fshrtnr?label=npm&color=cb3837&logo=npm)](https://oddb.it/shrtnr-npm-readme)
[![PyPI](https://img.shields.io/pypi/v/shrtnr?label=pypi&color=3775a9&logo=pypi&logoColor=white)](https://oddb.it/shrtnr-pypi-readme)
[![pub.dev](https://img.shields.io/pub/v/shrtnr?label=pub.dev&color=0175c2&logo=dart&logoColor=white)](https://oddb.it/shrtnr-pub-readme)

> A free, self-hosted URL shortener with built-in AI integration, click analytics, an admin dashboard. Runs on Cloudflare's free tier. Zero servers, zero monthly cost.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://oddb.it/shrtnr-deploy-top)

## Why shrtnr

Most URL shorteners either lock you into a SaaS with per-click pricing or require you to run a VPS. shrtnr runs on Cloudflare Workers + D1, both free tier. You own your data, your domain, and your short links.

It takes one click to deploy. You get a full admin UI, click analytics, SDKs for TypeScript, Python, and Dart, and an MCP server for AI assistants: all from a single Cloudflare Worker.

[**shrtnr**](https://oddb.it/shrtnr-info) is built by [**Oddbit**](https://oddb.it/website), a senior-led studio shipping Cloudflare, Firebase, Flutter, and AI integrations for funded startups and scale-ups. See what else we build at [oddbit.id](https://oddb.it/website).

## Preview

<table>
<tr>
<td width="33%"><a href="https://oddb.it/shrtnr-info"><img src="https://oddbit.id/images/shrtnr/dashboard-30d.png" alt="Admin dashboard with 30-day analytics"></a></td>
<td width="33%"><a href="https://oddb.it/shrtnr-info"><img src="https://oddbit.id/images/shrtnr/links-30d.png" alt="Links management"></a></td>
<td width="33%"><a href="https://oddb.it/shrtnr-info"><img src="https://oddbit.id/images/shrtnr/link-details-30d.png" alt="Per-link analytics"></a></td>
</tr>
<tr>
<td width="33%"><a href="https://oddb.it/shrtnr-info"><img src="https://oddbit.id/images/shrtnr/bundles-30d.png" alt="Bundles overview"></a></td>
<td width="33%"><a href="https://oddb.it/shrtnr-info"><img src="https://oddbit.id/images/shrtnr/bundle-details-30d.png" alt="Bundle analytics"></a></td>
<td width="33%"><a href="https://oddb.it/shrtnr-info"><img src="https://oddbit.id/images/shrtnr/settings.png" alt="Claude MCP integration"></a></td>
</tr>
</table>

<p align="right"><a href="https://oddb.it/shrtnr-info">See it in action →</a></p>

## Features

- **Free hosting** on Cloudflare Workers + D1 (no VPS, no containers, no monthly bill)
- **Short slugs** starting at 3 characters (32,768 unique combinations at that length)
- **Custom slugs** like `/my-campaign` alongside random slugs
- **Click analytics** with referrer, country, device, and browser tracking
- **Bundles** group related links (for example a project's blog post, GitHub repo, npm page, and docs) so you can track their combined engagement. A link can belong to more than one bundle.
- **Admin dashboard** for link management, analytics charts, and QR code generation
- **Multi-language admin UI** with English, Indonesian, and Swedish built in
- **API key authentication** with scoped Bearer tokens for programmatic access
- **SDKs** for TypeScript ([`@oddbit/shrtnr`](https://oddb.it/shrtnr-npm-readme)), Python ([`shrtnr`](https://oddb.it/shrtnr-pypi-readme)), and Dart/Flutter ([`shrtnr`](https://oddb.it/shrtnr-pub-readme))
- **Built-in MCP server** at `/_/mcp` with OAuth via Cloudflare Access, so Claude, Copilot, and other AI assistants can shorten URLs
- **One-click deploy** with automatic database provisioning and migrations

## Need help shipping it?

[**shrtnr**](https://oddb.it/shrtnr-info) is open source and free to self-host. If you want it deployed, customised, or integrated into your stack, [Oddbit](https://oddb.it/website) does that.

We're an Indonesian-based studio with roots in Sweden. [**shrtnr**](https://oddb.it/shrtnr-info) is one of the open-source tools we built for our own use and released.

[Talk to us at oddbit.id →](https://oddb.it/website)

![Oddbit logotype](https://oddbit.id/logo/oddbit-primary-logo-mint-green.png)

## Deploy

### One-click

Click the **Deploy to Cloudflare** button. Cloudflare forks the repo into your GitHub or GitLab account, provisions the D1 database and KV namespace that `wrangler.jsonc` declares, and deploys the Worker through [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/).

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://oddb.it/shrtnr-deploy-howto)

The Worker creates its own database schema on the first request, so there is no command to run afterwards. To confirm the deploy:

1. Open `https://<your-worker>.workers.dev/_/health`. It answers `"schema": { "ready": true }` once the schema is in place.
2. Open `https://<your-worker>.workers.dev/_/admin/dashboard` and create a link.
3. Protect the admin pages before you share the domain: see [Access Control](#access-control).

Every later push to your fork redeploys through Workers Builds, and the Worker applies any new migration on the first request after the deploy. See [Database schema](#database-schema) for how that works and what to check when it does not.

### Manual

```bash
git clone https://github.com/oddbit/shrtnr
cd shrtnr
yarn install
yarn wrangler-login
yarn deploy
```

`wrangler.jsonc` declares the D1 database and KV namespace by name only. The first `yarn deploy` creates both in your account through wrangler's [resource provisioning](https://developers.cloudflare.com/workers/wrangler/configuration/#automatic-resource-provisioning) and later deploys link to them by binding name. Wrangler also writes the new IDs into `wrangler.jsonc` on your machine; discard that change, the IDs are specific to your account and the deploy works without them.

The first request creates the schema. To apply it ahead of that request from your terminal, run `yarn db:migrate:remote`; the Worker and the CLI record their work in the same table, so either can go first.

### Continuous deployment

Cloudflare [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) redeploys the Worker on every push to your production branch. Schema changes need no separate step: the deployed Worker carries its migrations and applies the pending ones on the first request.

Two optional ways to apply migrations before the Worker takes traffic, for deployments that want the schema in place ahead of the first request:

- **GitHub Actions.** `.github/workflows/migrate.yml` runs `wrangler d1 migrations apply` after Cloudflare's check suite succeeds on `main`. It needs two repository secrets under **Settings > Secrets and variables > Actions**: `CLOUDFLARE_API_TOKEN` with **Workers Scripts: Edit** and **D1: Edit**, and `CLOUDFLARE_ACCOUNT_ID`. A fork created by the deploy button can add the workflow and the secrets the same way.
- **Workers Builds deploy command.** Set the project's deploy command to `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`. The token Workers Builds creates for itself holds Workers Scripts, KV and R2 edit rights; [its documented permission list](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) does not include D1, so add **D1: Edit** to that token under **My Profile > API Tokens** first, or the migration step fails with an authentication error.

### Database schema

Migrations live in `migrations/*.sql`. `yarn migrations:bundle` (run for you by `yarn dev`) writes them into `src/db/migrations.generated.ts`, which ships inside the Worker; the vitest suite fails when the two disagree, so add a migration, run the bundler, and commit both.

On the first request an isolate receives, the Worker applies every migration that is not yet recorded in D1's `d1_migrations` table, the same table with the same file names that `wrangler d1 migrations apply` uses. Each migration runs as one transaction with its bookkeeping row, so a race between isolates on a fresh deploy ends with each migration applied once. After that first request the check is a settled promise, and a fresh isolate reads the recorded schema version from KV before it touches D1, so redirects pay nothing for it.

Two routes report on the schema:

- `GET /_/health` includes `schema.version` (what this build expects), `schema.applied` (the last recorded migration) and `schema.ready`. It answers 503 with `"status": "degraded"` and the error when the schema could not be created.
- `GET /_/setup` lists applied and pending migrations without changing anything. `POST /_/setup` retries the migration. Both require a Cloudflare Access identity once `ACCESS_AUD` is set, and are rate-limited to ten requests a minute per client before that.

While the schema is missing, every other route answers a 503 page that names the failing migration and the database error. The usual causes are a Worker without a D1 binding named `DB` (check **Settings > Bindings** in the dashboard) or a migration that fails against data the original schema did not anticipate.

## Access Control

The admin UI (`/_/admin/*`) ships without built-in authentication. Protecting it is your responsibility. The app makes no assumptions about which method you use, but we recommend [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/) for most deployments. Other options include IP allowlists, firewall rules, Cloudflare Tunnel, or running on a private network.

### Recommended: Cloudflare Access

Cloudflare Access handles login, sessions, and SSO at the edge before requests reach your worker. It supports Google, GitHub, Microsoft, Okta, SAML, OIDC, and a built-in one-time PIN.

1. Open **Zero Trust** in the [Cloudflare dashboard](https://one.dash.cloudflare.com/)
2. Go to **Access > Applications > Add an application**
3. Choose **Self-hosted**
4. Set the application domain to your short domain (e.g. `oddb.it`) with path `_/admin/*`
5. Add a policy, for example:
   - **Action:** Allow
   - **Include rule:** Emails ending in `@yourcompany.com`
6. Under **Authentication**, enable at least one login method. "One-time PIN" works out of the box with no external IdP.

Visit `https://yourdomain.com` and Cloudflare Access will prompt you to log in before reaching the admin dashboard. See [Cloudflare's IdP guides](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/) for setup instructions.

#### Enable JWT verification in the worker

By default the worker trusts whatever Cloudflare Access lets through (network-layer protection). For defense-in-depth, enable cryptographic JWT verification so the worker validates every request independently:

1. In Zero Trust, go to your application's **Overview** tab and copy the **Application Audience (AUD) Tag**.
2. Set it as a worker secret:

```bash
npx wrangler secret put ACCESS_AUD
npx wrangler secret put ACCESS_JWKS_URL
```

`ACCESS_JWKS_URL` follows the pattern `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/certs`.

When `ACCESS_AUD` is set, the worker validates the JWT signature and audience claim on every admin and MCP request. When absent (local dev), it skips verification and takes the identity from the `dev_identity` cookie or `DEV_IDENTITY` instead. See [Local sign-in](#local-sign-in).



## Integrations

### SDKs

Shorten URLs, manage links, and read analytics from your own code.

- TypeScript/JavaScript: [`@oddbit/shrtnr`](https://oddb.it/shrtnr-npm-readme). Details in [sdk/typescript/README.md](sdk/typescript/README.md).
- Python: [`shrtnr`](https://oddb.it/shrtnr-pypi-readme). Sync and async clients on httpx. Details in [sdk/python/README.md](sdk/python/README.md).
- Dart/Flutter: [`shrtnr`](https://oddb.it/shrtnr-pub-readme). Details in [sdk/dart/README.md](sdk/dart/README.md).


### MCP Server (AI Integration)

<a href="https://oddb.it/shrtnr-info"><img align="right" width="40%" src="https://oddbit.id/images/shrtnr/claude.gif" alt="Claude using shrtnr MCP to shorten a URL"></a>

Every shrtnr deployment includes a built-in [MCP](https://modelcontextprotocol.io/) endpoint. Claude, GitHub Copilot, Cursor, and any MCP-compatible client can connect to it over Streamable HTTP transport to create and manage short links.

The MCP endpoint authenticates through [Cloudflare Access Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/). CF Access acts as the OAuth Authorization Server: it handles client registration, token issuance, and validation at the edge. The Worker receives authenticated requests with identity headers and does not implement any OAuth endpoints itself.

> **Authorization model.** The MCP endpoint does not split read from write today. Anyone whose email matches the CF Access policy on the MCP application can call every registered tool, including destructive ones (`delete_link`, `delete_bundle`, `remove_slug`, `archive_bundle`). Per-resource ownership still applies: a user cannot mutate another user's links or bundles. To grant a read-only audience, gate them through a separate MCP application or a separate Worker deployment with the write tools removed.

<br clear="all">

#### MCP setup

**1. Create a self-hosted Access application** for the MCP endpoint in Cloudflare Zero Trust:

CF Access MCP-type applications cannot be scoped to a path: they must own a full subdomain. The Worker detects requests on any host starting with `mcp.` and routes them to the MCP handler, so the subdomain **must** use the `mcp.` prefix (e.g., `mcp.your-domain.com`).

1. Go to **Access > Applications > Add an application > Self-hosted**
2. Set the domain to your MCP subdomain (e.g., `mcp.your-domain.com`) with no path
3. Add an allow policy for your email domain
4. Go to **Advanced settings**, expand **Managed OAuth (Beta)** and toggle it **on**
5. Enable **Allow localhost clients** and **Allow loopback clients**
6. Under **Allowed redirect URIs**, add one entry per integration:
   - `https://claude.ai/api/mcp/auth_callback`: for Claude.ai (legacy domain) and Claude Desktop
   - `https://claude.com/api/mcp/auth_callback`: for Claude.ai (current domain)
   - `https://dash.cloudflare.com/*`: for the CF Access AI Controls portal to authenticate and sync tools
   - Add equivalents for other platforms (ChatGPT, etc.) as needed. To find a client's exact callback URI: attempt to connect, let the flow fail, and read the `redirect_uri` from the error URL in the browser.
7. CF Access changes can take 30–60 seconds to propagate after saving.

**Register custom domains with the Worker:**

The Worker needs two custom domains: one for the app itself (short link redirects, admin dashboard) and one for the MCP endpoint. CF Access MCP applications require their own subdomain and cannot share a domain with a path, so the MCP domain uses a `mcp.` prefix: `mcp.<your-domain>`.

Add both domains in the Cloudflare dashboard:

1. Go to **Workers & Pages** > shrtnr > **Settings** > **Domains & Routes**
2. Click **Add Custom Domain** and enter your app domain (e.g., `your-domain.com`)
3. Click **Add Custom Domain** again and enter the MCP subdomain (e.g., `mcp.your-domain.com`)
4. Cloudflare creates the DNS records automatically for both: no manual DNS configuration needed

**2. Set Worker secrets and deploy.**

```bash
npx wrangler secret put MCP_ACCESS_AUD    # AUD tag from the MCP Access application
npx wrangler secret put ACCESS_JWKS_URL   # https://<your-team>.cloudflareaccess.com/cdn-cgi/access/certs
yarn deploy
```

**3. Disable "Block AI bots" for your domain.** Cloudflare's managed bot rule blocks requests from AI assistants (Claude, Copilot, etc.) at the edge before they reach your Worker. MCP clients connect from cloud infrastructure that Cloudflare classifies as AI bot traffic. If this rule is active, the OAuth handshake completes but the MCP connection itself is silently dropped.

Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > your zone > **Security** > filter by **Bot traffic** > find **Block AI bots** and set it to **Do not block (off)**. This must be disabled on every zone that hosts an MCP subdomain.

#### Available tools

The MCP server registers tools for managing links, custom slugs, bundles, QR codes, and analytics (lifetime, time-ranged, and dimensional breakdowns). Connected clients discover the full list via the standard MCP `tools/list` call: any AI assistant or inspector that speaks Streamable HTTP MCP will enumerate it on connect. The authoritative source is [`src/mcp/server.ts`](src/mcp/server.ts).

#### Connecting MCP clients

All clients connect to `https://mcp.your-domain.com`. The OAuth handshake is automatic: the client opens a browser for Cloudflare Access sign-in on first connect.

**Claude (claude.ai):** Settings > Integrations > Add custom connector. Enter `https://mcp.your-domain.com` as the URL.

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "shrtnr": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.your-domain.com"]
    }
  }
}
```

**Claude Code** (`.mcp.json`):

```json
{
  "mcpServers": {
    "shrtnr": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.your-domain.com"]
    }
  }
}
```

**VS Code / GitHub Copilot** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "shrtnr": {
      "type": "http",
      "url": "https://mcp.your-domain.com"
    }
  }
}
```

**Other clients:** Point at `https://mcp.your-domain.com` with Streamable HTTP transport. The server advertises its OAuth endpoints via `/.well-known/oauth-authorization-server`.

Replace `your-domain.com` with your actual short domain.

## API

Authentication is determined by route prefix:

| Route | Auth | Notes |
|---|---|---|
| `/_/api/*` | Bearer token | Public link-management API. Create keys from the admin UI under **API Keys** and pass them as `Authorization: Bearer sk_...`. |
| `/_/mcp` (and `mcp.<your-domain>`) | OAuth | MCP endpoint for AI assistants. Auth handled by Cloudflare Access. See the MCP section above. |
| `/_/admin/*` | None built in | Admin UI and admin-only API. Protect externally (see [Access Control](#access-control)). Not callable with API keys. |
| `/_/health` | Public | Health check. |

For full endpoint shapes, parameters, and example payloads, see the live API reference at **`/_/api/docs`** on your deployment, or fetch the OpenAPI 3.1 spec directly at **`/_/api/openapi.json`**. The spec is the source of truth: SDKs ([TypeScript](sdk/typescript/README.md), [Python](sdk/python/README.md), [Dart](sdk/dart/README.md)) regenerate from it when the API changes.

## Development

```bash
yarn install
yarn types                       # binding and runtime types from wrangler.jsonc, git-ignored
cp .dev.vars.example .dev.vars   # local identity settings, git-ignored
yarn test
yarn dev
```

`yarn types` writes `worker-configuration.d.ts`, which the typecheck needs. Rerun it after changing `wrangler.jsonc`. `yarn dev` creates the local D1 database and KV namespace on start and the schema on the first request; `yarn db:migrate:local` applies the schema from the CLI instead.

### Local sign-in

Cloudflare Access protects the admin pages in production. `wrangler dev` runs without it, and the admin pages still need an identity: writes are owner-gated and settings are stored per user. Pick one per browser:

```
http://localhost:8787/_/dev/login?as=you@example.com
```

This sets a `dev_identity` cookie for that browser only, so a second browser or a second Playwright context can act as a second owner. `/_/dev/login` without `as` shows a form; `/_/dev/logout` clears the cookie. Requests carrying no cookie fall back to `DEV_IDENTITY` from `.dev.vars`. Both routes answer 404 whenever `ACCESS_AUD` is set, so a deployment exposes nothing.

### SDK development

```bash
cd sdk
yarn install
yarn test
yarn build
```

## Related resources

- [Model Context Protocol](https://modelcontextprotocol.io/): MCP specification
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/): Zero-trust access control
- [Cloudflare Access Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/): MCP server protection with Access
- [Cloudflare MCP Portals](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/mcp-portals/): AI Controls portal for managing MCP servers in Zero Trust

## Built by Oddbit

[**shrtnr**](https://oddb.it/shrtnr-info) is one of several open-source tools maintained by **[Oddbit](https://oddb.it/website)**, a senior-led software studio in Indonesia with roots in Sweden.

If shrtnr is useful, the same team is available to build the rest of your stack. [oddbit.id](https://oddb.it/website).

### License & attribution

If you fork or build on this project, keep the license, notice, and attribution files intact. Apache 2.0 requires this, and it's good open-source etiquette.

- Source: <https://github.com/oddbit/shrtnr>
- License: [Apache License 2.0](LICENSE)
- Attribution: [NOTICE](NOTICE)
