import type { Metadata } from "next";
import "./globals.css";
import { CONTENT_SECURITY_POLICY } from "@/lib/csp";

export const metadata: Metadata = {
  title: "GhostDocs",
  description: "Browser-local document knowledge — your secrets stay local.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={CONTENT_SECURITY_POLICY}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
