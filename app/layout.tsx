import type { ReactNode } from "react";

import "./(interface)/styles/globals.css";

export const metadata = {
  title: "My App",
  description: "Generated from Figma",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
