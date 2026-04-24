"use client";

import type { ComponentProps, ReactNode } from "react";
import { ToastProvider } from "@lumia-ui/components";
import { AuthProvider, WorkspaceProvider } from "@xynes/auth-sdk";
import { getCmsAuthConfig } from "../lib/auth/config";

type ProvidersProps = {
  children: ReactNode;
};

const cmsAuthConfig = getCmsAuthConfig();

export function Providers({ children }: ProvidersProps) {
  const workspaceChildren = children as ComponentProps<
    typeof WorkspaceProvider
  >["children"];

  return (
    <ToastProvider>
      <AuthProvider config={cmsAuthConfig}>
        <WorkspaceProvider>{workspaceChildren}</WorkspaceProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
