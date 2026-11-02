import type { Metadata } from "next";
import "./globals.css";

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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
