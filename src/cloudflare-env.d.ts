import type { Env as AppEnv } from "./types";

declare global {
  namespace Cloudflare {
    interface Env extends AppEnv {}
  }
}
