"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@lumia-ui/components";
import { AuthProvider, WorkspaceProvider } from "@xynes/auth-sdk";
import { getCmsAuthConfig } from "../lib/auth/config";

type ProvidersProps = {
  children: ReactNode;
};

const cmsAuthConfig = getCmsAuthConfig();

export function Providers({ children }: ProvidersProps) {
  return (
    <ToastProvider>
      <AuthProvider config={cmsAuthConfig}>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
