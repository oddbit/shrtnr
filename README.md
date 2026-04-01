# shrtnr: Open-Source URL Shortener on Cloudflare Workers

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

### One-click

Click the **Deploy to Cloudflare** button above. Cloudflare will fork the repo, provision a D1 database, apply schema migrations, and deploy the Worker. No manual database setup required.

### Manual

```bash
git clone https://github.com/oddbit/shrtnr
cd shrtnr
yarn install
yarn wrangler-login
yarn db:create
yarn deploy             # applies migrations and deploys the Worker
```

### Continuous deployment

The deploy button sets up [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) automatically. Cloudflare detects the `deploy` script in `package.json` and uses it as the deploy command. Each push to your production branch applies pending D1 migrations and redeploys the Worker.

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

## Integrations

### TypeScript SDK

Shorten URLs, manage links, and read analytics from any TypeScript or JavaScript app.

- Package: [`@oddbit/shrtnr`](https://www.npmjs.com/package/@oddbit/shrtnr)
- Documentation: [sdk/README.md](sdk/README.md)

### MCP Server (AI Integration)

Every shrtnr deployment includes a built-in [MCP](https://modelcontextprotocol.io/) endpoint at `/_/mcp`. Claude, GitHub Copilot, Cursor, and any MCP-compatible client can connect to it over Streamable HTTP transport to create and manage short links.

The MCP endpoint uses OAuth authentication backed by [Cloudflare Access for SaaS](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/saas-mcp/). Users sign in through Cloudflare Access when connecting from an MCP client. API keys are not used for MCP.

#### MCP authentication setup

Follow Cloudflare's [Secure MCP servers with Access for SaaS](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/saas-mcp/) guide. The steps below summarize the Worker-specific configuration.

**1. Create a SaaS application in Cloudflare Zero Trust**

In the [Zero Trust dashboard](https://one.dash.cloudflare.com/), go to **Access > Applications > Add an application** and choose **SaaS**. Configure it as an OIDC application. Copy these values from the application page:

| Cloudflare field | Worker secret |
|---|---|
| Client ID | `ACCESS_CLIENT_ID` |
| Client secret | `ACCESS_CLIENT_SECRET` |
| Token endpoint | `ACCESS_TOKEN_URL` |
| Authorization endpoint | `ACCESS_AUTHORIZATION_URL` |
| Key endpoint (JWKS) | `ACCESS_JWKS_URL` |

Set the **Redirect URL** in the SaaS app to:

```
https://your-domain.com/callback
```

**2. Create a KV namespace for OAuth state**

```bash
wrangler kv namespace create OAUTH_KV
```

Copy the resulting `id` into `wrangler.toml` under the `[[kv_namespaces]]` binding for `OAUTH_KV`.

**3. Set Worker secrets**

```bash
wrangler secret put ACCESS_CLIENT_ID
wrangler secret put ACCESS_CLIENT_SECRET
wrangler secret put ACCESS_TOKEN_URL
wrangler secret put ACCESS_AUTHORIZATION_URL
wrangler secret put ACCESS_JWKS_URL
wrangler secret put COOKIE_ENCRYPTION_KEY
```

Generate `COOKIE_ENCRYPTION_KEY` with:

```bash
openssl rand -hex 32
```

**4. Deploy**

```bash
yarn deploy
```

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

#### Claude (claude.ai)

In Claude's settings, go to **Integrations > Add custom connector**:

- **Name:** shrtnr (or any name)
- **URL:** `https://your-domain.com/_/mcp`

Click **Add**. Claude handles the OAuth flow automatically. You will be prompted to sign in through Cloudflare Access.

#### Claude Desktop

Add to `claude_desktop_config.json`:

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

`mcp-remote` handles the OAuth handshake and opens a browser for Cloudflare Access sign-in.

#### Claude Code

Add to `.mcp.json` in your project root:

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

#### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json`:

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

VS Code handles the OAuth flow when you first connect.

#### Any MCP client

Point the client at your shrtnr endpoint:

- **URL:** `https://your-domain.com/_/mcp`
- **Transport:** Streamable HTTP
- **Auth:** OAuth 2.1 (the server advertises its authorization endpoints via `/.well-known/oauth-authorization-server`)

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

shrtnr is built and maintained by **[Oddbit](https://oddbit.id)**, a software development studio in Sweden.

If you fork or build on this project, please keep the license, notice, and attribution files intact. Apache 2.0 requires this, and it's good open-source etiquette.

- Source: <https://github.com/oddbit/shrtnr>
- License: [Apache License 2.0](LICENSE)
- Attribution: [NOTICE](NOTICE)
