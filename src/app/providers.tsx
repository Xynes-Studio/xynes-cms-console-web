"use client";

import type { ComponentProps, ReactNode } from "react";
import { ToastProvider } from "@lumia-ui/components";
import { AuthProvider, WorkspaceProvider } from "@xynes/auth-sdk";
import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "@xynes/i18n";
import { getCmsAuthConfig } from "../lib/auth/config";
import type { CmsMessages } from "../i18n/config";

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
          <WorkspaceProvider>{workspaceChildren}</WorkspaceProvider>
        </AuthProvider>
      </ToastProvider>
    </NextIntlClientProvider>
  );
}
