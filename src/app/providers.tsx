"use client";

import type { ComponentProps, ReactNode } from "react";
import { ToastProvider } from "@lumia-ui/components";
import { AuthProvider, WorkspaceProvider } from "@xynes/auth-sdk";
import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "@xynes/i18n";
import { getCmsAuthConfig } from "../lib/auth/config";
import type { CmsMessages } from "../i18n/config";
import { CmsFeatureFlagsProvider } from "../lib/feature-flags/CmsFeatureFlagsProvider";

type ProvidersProps = {
  children: ReactNode;
  locale: Locale;
  messages: CmsMessages;
};

const cmsAuthConfig = getCmsAuthConfig();

export function Providers({ children, locale, messages }: ProvidersProps) {
  const workspaceChildren = children as ComponentProps<
    typeof WorkspaceProvider
  >["children"];

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <ToastProvider>
        <AuthProvider config={cmsAuthConfig}>
          {/* STORAGE-LIVE-5: CmsFeatureFlagsProvider wires the auth-sdk's
              FeatureFlagsProvider to the gateway /flags route. Mounted
              INSIDE AuthProvider so it can read `getAccessToken` for
              authenticated workspace-scoped flag evaluation. Mounted
              OUTSIDE WorkspaceProvider so the same FeatureFlagsContext is
              shared across workspace switches (the SDK refetches /flags
              automatically when the access token rotates). No `phc_*` key
              in the browser — PostHog only runs on the gateway. */}
          <CmsFeatureFlagsProvider apiBaseUrl={cmsAuthConfig.apiBaseUrl}>
            <WorkspaceProvider>{workspaceChildren}</WorkspaceProvider>
          </CmsFeatureFlagsProvider>
        </AuthProvider>
      </ToastProvider>
    </NextIntlClientProvider>
  );
}
