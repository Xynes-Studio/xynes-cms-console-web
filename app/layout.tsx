import type { Metadata } from "next";
import { IconSprite } from "@lumia-ui/icons";
import "./globals.css";
import { Providers } from "../src/app/providers";

export const metadata: Metadata = {
  title: "Xynes CMS Console",
  description: "CMS console for Xynes platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <IconSprite />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
