import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { IconSprite } from "@lumia-ui/icons";
import "./globals.css";
import { Providers } from "../src/app/providers";
import {
  CMS_LOCALE_COOKIE,
  getCmsMessages,
  resolveCmsLocale,
} from "../src/i18n/config";

export const metadata: Metadata = {
  title: "Xynes CMS Console",
  description: "CMS console for Xynes platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveCmsLocale({
    cookieLocale: cookieStore.get(CMS_LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });
  const messages = getCmsMessages(locale);

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-background antialiased">
        <IconSprite />
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
