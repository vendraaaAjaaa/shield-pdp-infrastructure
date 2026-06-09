import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dana Sejahtera Shield",
  description: "Fintech privacy, compliance, and security validation portal for Shield-PDP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
