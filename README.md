![SHRTNR. logotype](./public/logotype-white.svg)
# Open-Source URL Shortener on Cloudflare Workers

> A free, self-hosted URL shortener with click analytics, an admin dashboard, and AI integration. Runs on Cloudflare's free tier. Zero servers, zero monthly cost.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/oddbit/shrtnr)

## Why shrtnr

Most URL shorteners either lock you into a SaaS with per-click pricing or require you to run a VPS. shrtnr runs on Cloudflare Workers + D1, both free tier. You own your data, your domain, and your short links.

It takes one click to deploy. You get a full admin UI, click analytics, a TypeScript SDK, and an MCP server for AI assistants: all from a single Cloudflare Worker.

## Features

- **Free hosting** on Cloudflare Workers + D1 (no VPS, no containers, no monthly bill)
- **Short slugs** starting at 3 characters (175,616 unique combinations at that length)
- **Vanity URLs** like `/my-campaign` alongside random slugs
- **Click analytics** with referrer, country, device, and browser tracking
- **Admin dashboard** for link management, analytics charts, and QR code generation
- **Multi-language admin UI** with English, Indonesian, and Swedish built in
- **API key authentication** with scoped Bearer tokens for programmatic access
- **TypeScript SDK** ([`@oddbit/shrtnr`](https://www.npmjs.com/package/@oddbit/shrtnr)) for Node.js and browser apps
- **Built-in MCP server** at `/_/mcp` with OAuth via Cloudflare Access, so Claude, Copilot, and other AI assistants can shorten URLs
- **One-click deploy** with automatic database provisioning and migrations

## Deploy

![Oddbit logotype](https://oddbit.id/logo/oddbit-primary-logo-mint-green.png)
**Running into issues or prefer someone else handle this?** 

[Oddbit](https://oddbit.id) built shrtnr and helps teams deploy, configure, and integrate it. Just [reach out](https://oddbit.id) and we'll get you sorted 🤓🚀

### One-click

Click the **Deploy to Cloudflare** button above. Cloudflare will fork the repo, provision a D1 database and KV namespace, and deploy the Worker.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/oddbit/shrtnr)

After the initial deploy finishes, apply database migrations once:

```bash
cd shrtnr
yarn install
npx wrangler d1 migrations apply DB --remote
```

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

To enable automatic migrations, add two repository secrets in GitHub under **Settings > Secrets and variables > Actions**:

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

#### Optional: Worker-level JWT validation

By default the worker trusts whatever CF Access lets through (network-layer protection). For defense-in-depth, you can also have the worker cryptographically verify the CF Access JWT on every admin request.

1. In Zero Trust, go to your application's **Overview** tab and copy the **Application Audience (AUD) Tag**.
2. Add it as a variable named `ACCESS_AUD` in the Cloudflare dashboard under **Workers & Pages > your worker > Settings > Variables**, or via the deploy button config if your fork supports it.

The worker detects the variable at runtime. When present, it validates the JWT signature and audience claim before serving any admin page. When absent, it falls back to trusting the Access cookie (normal behavior).

## Integrations

### TypeScript SDK

Shorten URLs, manage links, and read analytics from any TypeScript or JavaScript app.

- Package: [`@oddbit/shrtnr`](https://www.npmjs.com/package/@oddbit/shrtnr)
- Documentation: [sdk/README.md](sdk/README.md)

### MCP Server (AI Integration)

Every shrtnr deployment includes a built-in [MCP](https://modelcontextprotocol.io/) endpoint at `/_/mcp`. Claude, GitHub Copilot, Cursor, and any MCP-compatible client can connect to it over Streamable HTTP transport to create and manage short links.

The MCP endpoint authenticates through OAuth via [Cloudflare Access for SaaS](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/saas-mcp/). API keys are not used for MCP.

#### MCP setup

**1. Create a SaaS OIDC application** in Cloudflare Zero Trust following the [Secure MCP servers with Access for SaaS](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/saas-mcp/) guide. Set the redirect URL to `https://your-domain.com/oauth/callback`. Copy these values from the application page:

| SaaS app field | Worker secret |
|---|---|
| Client ID | `ACCESS_CLIENT_ID` |
| Client secret | `ACCESS_CLIENT_SECRET` |
| Token endpoint | `ACCESS_TOKEN_URL` |
| Authorization endpoint | `ACCESS_AUTHORIZATION_URL` |
| Key endpoint (JWKS) | `ACCESS_JWKS_URL` |

**2. Set Worker secrets and deploy.**

```bash
# Set all six secrets (wrangler prompts for each value)
npx wrangler secret put ACCESS_CLIENT_ID
npx wrangler secret put ACCESS_CLIENT_SECRET
npx wrangler secret put ACCESS_TOKEN_URL
npx wrangler secret put ACCESS_AUTHORIZATION_URL
npx wrangler secret put ACCESS_JWKS_URL
```

```bash
# Generate and set the cookie encryption key
openssl rand -hex 32 | npx wrangler secret put COOKIE_ENCRYPTION_KEY
```

```bash
# Deploy (KV namespace is created automatically on first deploy)
yarn deploy
```

**3. Disable "Block AI bots" for your domain.** Cloudflare's managed bot rule blocks requests from AI assistants (Claude, Copilot, etc.) at the edge before they reach your Worker. MCP clients connect from cloud infrastructure that Cloudflare classifies as AI bot traffic. If this rule is active, the OAuth handshake completes but the MCP connection itself is silently dropped.

Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > your zone > **Security** > filter by **Bot traffic** > find **Block AI bots** and set it to **Do not block (off)**.

#### Available tools

| Tool | Description |
|---|---|
| `health` | Check server health and version |
| `list_links` | List all short links with slugs and click counts |
| `get_link` | Get details for a link by ID |
| `create_link` | Shorten a URL (supports labels, vanity slugs, expiry) |
| `update_link` | Update a link's URL, label, or expiry |
| `disable_link` | Disable a link so it stops redirecting |
| `add_vanity_slug` | Add a custom slug to an existing link |
| `get_link_analytics` | Get click stats by country, referrer, device, and browser |

#### Connecting MCP clients

All clients connect to `https://your-domain.com/_/mcp`. The OAuth handshake is automatic: the client opens a browser for Cloudflare Access sign-in on first connect.

**Claude (claude.ai):** Settings > Integrations > Add custom connector. Enter `https://your-domain.com/_/mcp` as the URL.

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "shrtnr": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-domain.com/_/mcp"]
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
      "args": ["mcp-remote", "https://your-domain.com/_/mcp"]
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
      "url": "https://your-domain.com/_/mcp"
    }
  }
}
```

**Other clients:** Point at `https://your-domain.com/_/mcp` with Streamable HTTP transport. The server advertises its OAuth endpoints via `/.well-known/oauth-authorization-server`.

Replace `your-domain.com` with your actual short domain.

## API

Authentication model:

- **Admin UI** (`/_/admin/*`) has no built-in auth. Protect it externally (see Access Control above).
- **API key Bearer tokens** grant scoped access to the public link-management API. Create keys from the admin UI under API Keys. Pass them as `Authorization: Bearer sk_...`.
- **MCP endpoint** (`/_/mcp`) uses OAuth via Cloudflare Access. See the MCP section above.
- The health endpoint is public and does not require auth.

Administrative endpoints (settings, dashboard stats, key management) live under `/_/admin/api/*` and are not accessible via API keys.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/_/api/links` | Bearer token | List all short links |
| `POST` | `/_/api/links` | Bearer token | Shorten a URL (create a new link) |
| `GET` | `/_/api/links/:id` | Bearer token | Get a link with click stats |
| `PUT` | `/_/api/links/:id` | Bearer token | Update a link's URL, label, or expiry |
| `POST` | `/_/api/links/:id/slugs` | Bearer token | Add a vanity slug to a link |
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

## Attribution

shrtnr is built and maintained by **[Oddbit](https://oddbit.id)**. 

If you fork or build on this project, keep the license, notice, and attribution files intact. Apache 2.0 requires this, and it's good open-source etiquette.

- Source: <https://github.com/oddbit/shrtnr>
- License: [Apache License 2.0](LICENSE)
- Attribution: [NOTICE](NOTICE)
