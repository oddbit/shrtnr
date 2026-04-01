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
- **Built-in MCP server** at `/_/mcp` so Claude, Copilot, and other AI assistants can shorten URLs
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

The endpoint requires an API key. Create one from the admin UI under **API Keys** with `create,read` scope.

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

#### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "shrtnr": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-domain.com/_/mcp"],
      "env": {
        "AUTHORIZATION": "Bearer sk_your_api_key"
      }
    }
  }
}
```

#### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "shrtnr": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-domain.com/_/mcp"],
      "env": {
        "AUTHORIZATION": "Bearer sk_your_api_key"
      }
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
      "url": "https://your-domain.com/_/mcp",
      "headers": {
        "Authorization": "Bearer sk_your_api_key"
      }
    }
  }
}
```

#### Cursor / Windsurf

Use the same `mcp-remote` approach as Claude Desktop, or configure via each editor's MCP settings with the endpoint URL `https://your-domain.com/_/mcp` and an `Authorization: Bearer sk_...` header.

#### Any HTTP MCP client

Point the client at your shrtnr endpoint:

- **URL:** `https://your-domain.com/_/mcp`
- **Transport:** Streamable HTTP
- **Auth header:** `Authorization: Bearer sk_your_api_key`

Replace `your-domain.com` with your actual short domain and `sk_your_api_key` with a key created from the admin UI.

## API

Authentication model:

- **Admin UI** (`/_/admin/*`) has no built-in auth. Protect it externally (see Access Control above).
- **API key Bearer tokens** grant scoped access to the public link-management API. Create keys from the admin UI under API Keys. Pass them as `Authorization: Bearer sk_...`.
- The health endpoint is public and does not require auth.

Administrative endpoints (settings, dashboard stats, key management) live under `/_/admin/api/*` and are not accessible via API keys.

| Method | Path | Description |
|---|---|---|
| `GET` | `/_/api/links` | List all short links |
| `POST` | `/_/api/links` | Shorten a URL (create a new link) |
| `GET` | `/_/api/links/:id` | Get a link with click stats |
| `PUT` | `/_/api/links/:id` | Update a link's URL, label, or expiry |
| `POST` | `/_/api/links/:id/slugs` | Add a vanity slug to a link |
| `POST` | `/_/api/links/:id/disable` | Disable a link |
| `GET` | `/_/api/links/:id/analytics` | Get click analytics (referrer, country, device, browser) |
| `GET` | `/_/health` | Health check (public) |
| `POST` | `/_/mcp` | MCP endpoint for AI assistants (Streamable HTTP transport) |

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
