![SHRTNR. logotype](./public/logotype-white.svg)
# Open-Source URL Shortener on Cloudflare Workers

> A free, self-hosted URL shortener with click analytics, an admin dashboard, and AI integration. Runs on Cloudflare's free tier. Zero servers, zero monthly cost.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://oddb.it/shrtnr-deploy-top)

## Why shrtnr

Most URL shorteners either lock you into a SaaS with per-click pricing or require you to run a VPS. shrtnr runs on Cloudflare Workers + D1, both free tier. You own your data, your domain, and your short links.

It takes one click to deploy. You get a full admin UI, click analytics, SDKs for TypeScript, Python, and Dart, and an MCP server for AI assistants: all from a single Cloudflare Worker.

Read more on our [website](https://oddbit.id).

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

## Deploy

![Oddbit logotype](https://oddbit.id/logo/oddbit-primary-logo-mint-green.png)
**👉 Running into issues or prefer someone else handle this? 👈** 

[Oddbit](https://oddbit.id) built shrtnr and helps teams deploy, configure, and integrate it. Just [reach out](https://oddbit.id) and we'll get you sorted 🤓🚀

### One-click

Click the **Deploy to Cloudflare** button above. Cloudflare will fork the repo, provision a D1 database and KV namespace, and deploy the Worker.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://oddb.it/shrtnr-deploy-howto)


**⚠️ Important: GitHub Actions workflows are not copied when Cloudflare forks your repo.** This means the automatic migration workflow (`.github/workflows/migrate.yml`) does not exist in your fork after the initial deploy. You must set up migrations yourself. Without running migrations, the database schema will be missing and the app will not work.

After the initial deploy, apply the database migrations immediately:

```bash
cd shrtnr
yarn install
npx wrangler d1 migrations apply DB --remote
```

Then, every time you pull updates and push them to your fork, re-run migrations to apply any new schema changes:

```bash
npx wrangler d1 migrations apply DB --remote
```

To automate this, copy `.github/workflows/migrate.yml` from the source repo into your fork and add the required secrets (see [Continuous deployment](#continuous-deployment) below).

### Manual

```bash
git clone https://github.com/oddbit/shrtnr
cd shrtnr
yarn install
yarn wrangler-login
yarn db:create
yarn deploy
yarn db:migrate:remote
```

### Continuous deployment

Cloudflare [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) redeploys the Worker on every push to your production branch. Database migrations are handled separately by the included GitHub Actions workflow at `.github/workflows/migrate.yml`, which triggers when Cloudflare's check suite completes successfully.

**If you used one-click deploy:** Cloudflare forks the repo but does not copy GitHub Actions workflows. To get automatic migrations, copy the file manually:

1. In your forked repo, create `.github/workflows/migrate.yml` with the contents from the [source repo](https://github.com/oddbit/shrtnr/blob/main/.github/workflows/migrate.yml).
2. Add two repository secrets in GitHub under **Settings > Secrets and variables > Actions**:

- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with **Workers Scripts: Edit** and **D1: Edit** permissions
- `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID (visible in the dashboard URL or the right sidebar of any zone page)

Without these secrets, you can still deploy: Workers Builds handles the code, and you run `yarn db:migrate:remote` manually when pushing schema changes.

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

When `ACCESS_AUD` is set, the worker validates the JWT signature and audience claim on every admin and MCP request. When absent (local dev), it skips verification and falls back to dev mode.



## Integrations

### SDKs

Shorten URLs, manage links, and read analytics from your own code.

- TypeScript/JavaScript: [`@oddbit/shrtnr`](https://oddb.it/shrtnr-npm-readme) — see [sdk/typescript/README.md](sdk/typescript/README.md).
- Python: [`shrtnr`](https://oddb.it/shrtnr-pypi-readme) — see [sdk/python/README.md](sdk/python/README.md). Sync and async clients on httpx.
- Dart/Flutter: [`shrtnr`](https://oddb.it/shrtnr-pub-readme) — see [sdk/dart/README.md](sdk/dart/README.md).

All three SDKs wrap the same public HTTP API and stay feature-aligned per the SDK parity rule in [CLAUDE.md](CLAUDE.md). Releases are automated via OIDC trusted publishing; details in [docs/release-automation.md](docs/release-automation.md).

### MCP Server (AI Integration)

Every shrtnr deployment includes a built-in [MCP](https://modelcontextprotocol.io/) endpoint. Claude, GitHub Copilot, Cursor, and any MCP-compatible client can connect to it over Streamable HTTP transport to create and manage short links.

The MCP endpoint authenticates through [Cloudflare Access Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/). CF Access acts as the OAuth Authorization Server: it handles client registration, token issuance, and validation at the edge. The Worker receives authenticated requests with identity headers and does not implement any OAuth endpoints itself.

#### MCP setup

**1. Create a self-hosted Access application** for the MCP endpoint in Cloudflare Zero Trust:

CF Access MCP-type applications cannot be scoped to a path — they must own a full subdomain. The Worker detects requests on any host starting with `mcp.` and routes them to the MCP handler, so the subdomain **must** use the `mcp.` prefix (e.g., `mcp.your-domain.com`).

1. Go to **Access > Applications > Add an application > Self-hosted**
2. Set the domain to your MCP subdomain (e.g., `mcp.your-domain.com`) with no path
3. Add an allow policy for your email domain
4. Go to **Advanced settings**, expand **Managed OAuth (Beta)** and toggle it **on**
5. Enable **Allow localhost clients** and **Allow loopback clients**
6. Under **Allowed redirect URIs**, add one entry per integration:
   - `https://claude.ai/api/mcp/auth_callback` — for Claude.ai (legacy domain) and Claude Desktop
   - `https://claude.com/api/mcp/auth_callback` — for Claude.ai (current domain)
   - `https://dash.cloudflare.com/*` — for the CF Access AI Controls portal to authenticate and sync tools
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

| Tool | Description |
|---|---|
| `health` | Check server health and version |
| `list_links` | List all short links with slugs and click counts |
| `get_link` | Get details for a link by ID |
| `create_link` | Shorten a URL (supports labels, custom slugs, expiry) |
| `update_link` | Update a link's URL, label, or expiry |
| `disable_link` | Disable a link so it stops redirecting |
| `add_custom_slug` | Add a custom slug to an existing link |
| `get_link_analytics` | Get click stats by country, referrer, device, and browser |

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

Authentication model:

- **Admin UI** (`/_/admin/*`) has no built-in auth. Protect it externally (see Access Control above).
- **API key Bearer tokens** grant scoped access to the public link-management API. Create keys from the admin UI under API Keys. Pass them as `Authorization: Bearer sk_...`.
- **MCP endpoint** (`mcp.your-domain.com`) uses OAuth via Cloudflare Access. See the MCP section above.
- The health endpoint is public and does not require auth.

Administrative endpoints (settings, dashboard stats, key management) live under `/_/admin/api/*` and are not accessible via API keys.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/_/api/links` | Bearer token | List all short links |
| `POST` | `/_/api/links` | Bearer token | Shorten a URL (create a new link) |
| `GET` | `/_/api/links/:id` | Bearer token | Get a link with click stats |
| `PUT` | `/_/api/links/:id` | Bearer token | Update a link's URL, label, or expiry |
| `POST` | `/_/api/links/:id/slugs` | Bearer token | Add a custom slug to a link |
| `POST` | `/_/api/links/:id/disable` | Bearer token | Disable a link |
| `GET` | `/_/api/links/:id/analytics` | Bearer token | Get click analytics (referrer, country, device, browser) |
| `GET` | `/_/health` | Public | Health check |
| `POST` | `/_/mcp` | OAuth | MCP endpoint for AI assistants (Streamable HTTP) |

## Development

```bash
yarn install
yarn db:migrate         # apply migrations to local D1
yarn test
yarn dev
```

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

## Attribution

shrtnr is built and maintained by **[Oddbit](https://oddbit.id)**. 

If you fork or build on this project, keep the license, notice, and attribution files intact. Apache 2.0 requires this, and it's good open-source etiquette.

- Source: <https://github.com/oddbit/shrtnr>
- License: [Apache License 2.0](LICENSE)
- Attribution: [NOTICE](NOTICE)
