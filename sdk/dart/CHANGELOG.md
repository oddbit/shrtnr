# Changelog

## 0.1.0

Initial Dart SDK release. Mirrors the TypeScript SDK's public surface:

- `ShrtnrClient` with link CRUD, custom slug management, click analytics, QR
  code retrieval, and a health endpoint.
- `ShrtnrException` for non-2xx responses, carrying status code, message, and
  raw body.
- `ApiKeyAuth` for Bearer-token authentication.
- Timestamp fields (`createdAt`, `expiresAt`, `disabledAt`, health
  `timestamp`) exposed as `DateTime` in UTC; JSON flag fields (`is_custom`,
  `is_primary`) exposed as `bool`.
