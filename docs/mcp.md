# MCP server

Every shrtnr deployment includes a [Model Context Protocol](https://modelcontextprotocol.io/) server. Claude, GitHub Copilot, Cursor and any other MCP client connect to it over Streamable HTTP and get tools to create links, attach slugs, group links into bundles and query analytics. The server runs inside the same Worker as the redirects and the admin UI; there is nothing extra to deploy.

The endpoint authenticates through [Cloudflare Access Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/). Cloudflare Access acts as the OAuth authorization server: it handles client registration, token issuance and validation at the edge. The Worker receives requests that already carry a verified identity and implements no OAuth endpoints of its own. Every tool call runs as the signed-in person, so links an assistant creates belong to the user who connected it, not to a shared service account.

## Authorization model

The MCP endpoint does not split read from write. Anyone whose email matches the Access policy on the MCP application can call every registered tool, including the destructive ones (`delete_link`, `delete_bundle`, `remove_slug`). What a tool does once called is bounded by the same rules the admin UI and the API apply, because all three go through one service layer.

A caller reads anything in the deployment and changes only what they own. `update_link`, `disable_link`, `enable_link`, `delete_link`, `disable_slug`, `enable_slug`, `remove_slug`, `update_bundle`, `archive_bundle`, `unarchive_bundle`, `delete_bundle` and `remove_link_from_bundle` all refuse on another user's resource. `delete_link` additionally refuses on any link that has recorded a click, and `remove_slug` on any slug that has; disable is the operation that works there. Two tools are open to every caller by design and carry no owner check: `add_custom_slug` adds a slug to any link, and `add_link_to_bundle` files any link into any bundle. A refusal arrives as an error message naming the rule, not as an HTTP status. The full permission table is in [Access control](access-control.md#permission-model).

To grant a read-only audience, gate them through a separate MCP application or a separate Worker deployment with the write tools removed.

## Setup

### 1. Create an Access application for the MCP endpoint

Access applications of the MCP type cannot be scoped to a path: they must own a full subdomain. The Worker routes every request whose host starts with `mcp.` to the MCP handler, so the subdomain must use that prefix, for example `mcp.your-domain.com`.

In Cloudflare Zero Trust:

1. Go to **Access > Applications > Add an application > Self-hosted**.
2. Set the domain to your MCP subdomain (`mcp.your-domain.com`) with no path.
3. Add an allow policy for your email domain.
4. Open **Advanced settings**, expand **Managed OAuth (Beta)** and toggle it on.
5. Enable **Allow localhost clients** and **Allow loopback clients**.
6. Under **Allowed redirect URIs**, add one entry per integration:
   - `https://claude.ai/api/mcp/auth_callback` for Claude.ai on the legacy domain and Claude Desktop
   - `https://claude.com/api/mcp/auth_callback` for Claude.ai on the current domain
   - `https://dash.cloudflare.com/*` for the Cloudflare AI Controls portal to authenticate and sync tools
   - Equivalents for other platforms as needed. To find a client's exact callback URI, attempt to connect, let the flow fail, and read `redirect_uri` from the error URL in the browser.
7. Access changes take 30 to 60 seconds to propagate after saving.

### 2. Register two custom domains with the Worker

The Worker needs one domain for the app (redirects and admin) and one for the MCP endpoint, because an MCP Access application cannot share a domain with a path.

1. Go to **Workers & Pages > shrtnr > Settings > Domains & Routes**.
2. Click **Add Custom Domain** and enter your app domain (`your-domain.com`).
3. Click **Add Custom Domain** again and enter the MCP subdomain (`mcp.your-domain.com`).

Cloudflare creates the DNS records for both. No manual DNS work is needed.

### 3. Set Worker secrets and deploy

```bash
npx wrangler secret put MCP_ACCESS_AUD    # AUD tag from the MCP Access application
npx wrangler secret put ACCESS_JWKS_URL   # https://<your-team>.cloudflareaccess.com/cdn-cgi/access/certs
yarn deploy
```

### 4. Turn off "Block AI bots" for the zone

Cloudflare's managed bot rule blocks requests from AI assistants at the edge before they reach your Worker. MCP clients connect from cloud infrastructure that Cloudflare classifies as AI bot traffic. With the rule active, the OAuth handshake completes but the MCP connection itself is dropped without an error.

Go to the [Cloudflare dashboard](https://dash.cloudflare.com/) > your zone > **Security**, filter by **Bot traffic**, find **Block AI bots** and set it to **Do not block (off)**. Do this on every zone that hosts an MCP subdomain.

## Tools

Clients discover the tool list through the standard `tools/list` call, so any MCP client or inspector enumerates it on connect. The authoritative source is [`src/mcp/server.ts`](../src/mcp/server.ts). The tools fall into five groups:

- **Links**: create, read, search, list by owner, update, disable, enable, delete.
- **Slugs**: add a custom slug to a link, disable, enable, remove.
- **Bundles**: create, read, list, update, archive, unarchive, delete, add and remove member links, list a link's bundles.
- **Analytics**: per-link analytics, timeline and single-dimension breakdowns; cross-link totals, trending links, and breakdowns by country, referrer and device; side-by-side link comparison; combined analytics for a bundle.
- **QR codes**: an SVG for any slug, with the scan tracked as QR traffic.

Every tool carries MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`) so a client can ask for confirmation before a destructive call. Three rules the tool descriptions spell out, because they decide which tool an assistant should reach for:

- **Disable, do not delete, once a link has clicks.** `delete_link` and `remove_slug` refuse anything with recorded clicks. `disable_link` and `disable_slug` stop the redirect, keep the history, and are reversible.
- **Creating a link is idempotent.** `create_link` returns the existing link when the destination is already shortened, after normalizing the trailing slash. An assistant never has to search before shortening.
- **Analytics are scoped to a time range.** Every analytics response leads with `range_used`. When the caller passes no range, the tool uses the connecting user's `default_range` setting from the admin UI, and applies the same bot and self-referrer filters the dashboard applies for that user.

## Connecting clients

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

**Other clients:** point at `https://mcp.your-domain.com` with Streamable HTTP transport. The server advertises its OAuth endpoints at `/.well-known/oauth-authorization-server`.

Replace `your-domain.com` with your short domain throughout.

## Related resources

- [Model Context Protocol](https://modelcontextprotocol.io/): the MCP specification
- [Cloudflare Access Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/): MCP server protection with Access
- [Cloudflare MCP Portals](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/mcp-portals/): the AI Controls portal for managing MCP servers in Zero Trust
