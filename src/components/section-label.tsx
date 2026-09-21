// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC, PropsWithChildren } from "hono/jsx";

type SectionLabelProps = PropsWithChildren<{
  icon?: string;
  id?: string;
}>;

export const SectionLabel: FC<SectionLabelProps> = ({ icon, id, children }) => (
  <div class="section-label" id={id}>
    {icon && <span aria-hidden="true" class="icon">{icon}</span>}
    <span>{children}</span>
  </div>
);
