# MCP server

Every shrtnr deployment includes a [Model Context Protocol](https://modelcontextprotocol.io/) server. Claude, GitHub Copilot, Cursor and any other MCP client connect over Streamable HTTP and get tools to create links, attach slugs, group links into bundles and query analytics. The server runs inside the same Worker as the redirects and the admin UI. Nothing extra to deploy.

The endpoint authenticates through [Cloudflare Access Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/). Access is the OAuth authorization server: it handles client registration, token issuance and validation at the edge. Requests reach the Worker with a verified identity, and the Worker implements no OAuth endpoints of its own.

**Every tool call runs as the signed-in person.** Links an assistant creates belong to the user who connected it, not to a shared service account.

## Authorization model

**The MCP endpoint does not split read from write.** Anyone whose email matches the Access policy on the MCP application can call every registered tool, including those annotated `destructiveHint`. The same service layer as the admin UI and the API bounds what each tool does.

- **Read anything, change only what you own.** Every tool that changes or removes a link, slug or bundle refuses on another user's resource. Its description names the rule.
- **Clicked means disable, not delete.** `delete_link` refuses on any link with a recorded click, and `remove_slug` on any such slug. Disable works there.
- **Two tools are open to every caller by design** and carry no owner check: `add_custom_slug` adds a slug to any link, and `add_link_to_bundle` files any link into any bundle.
- **A refusal is an error message naming the rule**, not an HTTP status.

The full permission table is in [Access control](access-control.md#permission-model).

To grant a read-only audience, gate them through a separate MCP application or a separate Worker deployment with the write tools removed.

## Setup

### 1. Create an Access application for the MCP endpoint

**An MCP-type Access application owns a full subdomain; it cannot be scoped to a path.** The Worker routes every request whose host starts with `mcp.` to the MCP handler, so the subdomain must use that prefix, for example `mcp.your-domain.com`.

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
7. Save, then wait 30 to 60 seconds for Access changes to propagate.

### 2. Register two custom domains with the Worker

The Worker needs one domain for the app (redirects and admin) and one for the MCP endpoint, because an MCP Access application cannot share a domain with a path.

1. Go to **Workers & Pages > shrtnr > Settings > Domains & Routes**.
2. Click **Add Custom Domain** and enter your app domain (`your-domain.com`).
3. Click **Add Custom Domain** again and enter the MCP subdomain (`mcp.your-domain.com`).

Cloudflare creates the DNS records for both.

### 3. Set Worker secrets and deploy

```bash
npx wrangler secret put MCP_ACCESS_AUD    # AUD tag from the MCP Access application
npx wrangler secret put ACCESS_JWKS_URL   # https://<your-team>.cloudflareaccess.com/cdn-cgi/access/certs
yarn deploy
```

**No `MCP_ACCESS_AUD`, no MCP.** Until it is set, `/_/mcp` answers 404 on every host. The admin application's `ACCESS_AUD` does not stand in for it, because the MCP application signs its tokens with its own tag.

### 4. Turn off "Block AI bots" for the zone

**The managed "Block AI bots" rule silently drops MCP connections.** MCP clients connect from cloud infrastructure that Cloudflare classifies as AI bot traffic. With the rule active, the OAuth handshake completes, but the edge drops the MCP connection itself without an error.

Go to the [Cloudflare dashboard](https://dash.cloudflare.com/) > your zone > **Security**, filter by **Bot traffic**, find **Block AI bots** and set it to **Do not block (off)**. Repeat on every zone that hosts an MCP subdomain.

## Tools

The authoritative source is [`src/mcp/server.ts`](../src/mcp/server.ts). Clients discover the exact set through the standard `tools/list` call, so any MCP client or inspector enumerates it on connect. The tools cover links, slugs, bundles, analytics and QR codes, plus a health check.

Every tool carries MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`), so a client can ask for confirmation before a destructive call. The tool descriptions spell out three rules that decide which tool an assistant reaches for:

- **Disable, do not delete, once a link has clicks.** `delete_link` and `remove_slug` refuse anything with recorded clicks. `disable_link` and `disable_slug` stop the redirect, keep the history, and are reversible.
- **Creating a link is idempotent.** `create_link` returns the existing link when the destination is already shortened, after normalizing the trailing slash. An assistant never has to search before shortening.
- **Analytics are scoped to a time range.** Every analytics response leads with `range_used`. Without a range, the tool uses the connecting user's `default_range` setting from the admin UI. It applies the same bot and self-referrer filters the dashboard applies for that user.

## Connecting clients

All clients connect to `https://mcp.your-domain.com`. Replace `your-domain.com` with your short domain throughout. On first connect, the client opens a browser for Cloudflare Access sign-in; the OAuth handshake needs no other input.

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

## Related resources

- [Model Context Protocol](https://modelcontextprotocol.io/): the MCP specification
- [Cloudflare Access Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/): MCP server protection with Access
- [Cloudflare MCP Portals](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/mcp-portals/): the AI Controls portal for managing MCP servers in Zero Trust
