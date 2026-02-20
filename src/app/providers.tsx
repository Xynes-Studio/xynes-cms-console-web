"use client";

import type { ReactNode } from "react";
import { AuthProvider, WorkspaceProvider } from "@xynes/auth-sdk";
import { getCmsAuthConfig } from "../lib/auth/config";

type ProvidersProps = {
  children: ReactNode;
};

const cmsAuthConfig = getCmsAuthConfig();

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider config={cmsAuthConfig}>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </AuthProvider>
  );
}
