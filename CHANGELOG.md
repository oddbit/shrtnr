# Changelog

## 0.2.0

- App-managed API keys with SHA-256 hashed storage
- Dual authentication: Cloudflare Access (admin) and Bearer token (API keys)
- Scope-based authorization: create, read, or both
- API key management endpoints (create, list, delete)
- Per-user key isolation with owner-only deletion
- Raw key shown once at creation, prefix stored for display
- Automatic last-used tracking on each API call

## 0.1.0

Initial release.

- URL shortening with auto-generated and vanity slugs
- Click analytics with country, referrer, device, and browser tracking
- Dashboard with top links, recent links, and country stats
- Link detail page with performance breakdown and QR code generation
- Disable/enable links via expiry timestamps
- Per-user theme switching (oddbit, dark, light)
- Settings page with slug length configuration and update checker
- Cloudflare Access authentication
- URL-based admin routing with browser history support
