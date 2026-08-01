"use client";

import React from "react";

/** Legacy pass-through provider. Main data sync is handled by SportsDataProvider. */
export function SupabaseSyncProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
