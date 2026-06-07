import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interdimensional Cable",
  description: "A TV screen that plays random AI videos from Reddit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-black overflow-hidden">{children}</body>
    </html>
  );
}
