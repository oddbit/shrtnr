// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { Env } from "../types";
import type { AccessUser } from "../access";
import type { ErrorFormat } from "../unhandled";

export type AuthContext = {
  source: "apikey";
  scope: string | null;
  identity: string;
};

export type HonoEnv = {
  Bindings: Env;
  Variables: {
    auth: AuthContext;
    user: AccessUser | null;
    identity: string;
    /** Set by `answersJson` on the JSON route groups; read by the error handler. */
    errorFormat?: ErrorFormat;
  };
};
