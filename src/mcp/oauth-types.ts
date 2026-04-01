// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Identity props populated by the Cloudflare Access OAuth flow
 * and passed to the McpAgent as this.props.
 */
export interface Props {
  accessToken: string;
  email: string;
  login: string;
  name: string;
}
