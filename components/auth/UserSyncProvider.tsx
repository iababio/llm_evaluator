"use client";

import React from "react";
import { useUserSync } from "@/hooks/useUserSync";

interface UserSyncProviderProps {
  children: React.ReactNode;
}

export default function UserSyncProvider({ children }: UserSyncProviderProps) {
  // This hook will automatically sync the user when loaded
  const { isSyncing, error } = useUserSync();

  // You could handle sync errors here if needed
  // if (error) {
  //   console.error("Error syncing user:", error);
  // }

  return <>{children}</>;
}
