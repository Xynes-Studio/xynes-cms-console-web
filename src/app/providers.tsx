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
          {/* BUG-CMS-5 / STORAGE-LIVE-5: CmsFeatureFlagsProvider wires the
              auth-sdk's FeatureFlagsProvider to the gateway /flags route.
              MUST be mounted INSIDE AuthProvider AND INSIDE WorkspaceProvider
              so it can read both:
                - useAuth().getAccessToken — to authenticate the /flags fetch
                - useWorkspace().currentWorkspace — to thread the active
                  workspace id into the /flags request as X-XS-Workspace-Id,
                  which the gateway forwards to PostHog as a `workspace`
                  group for per-workspace flag rollouts (e.g. flipping the
                  `cms_editor_storage_uploads` flag ON for a single
                  workspace in the PostHog admin UI).
              No `phc_*` key in the browser — PostHog only runs on the
              gateway. */}
          <WorkspaceProvider>
            <CmsFeatureFlagsProvider apiBaseUrl={cmsAuthConfig.apiBaseUrl}>
              {workspaceChildren}
            </CmsFeatureFlagsProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </ToastProvider>
    </NextIntlClientProvider>
  );
}
