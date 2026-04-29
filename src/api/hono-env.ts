// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { Env } from "../types";
import type { AccessUser } from "../access";

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
  };
};
