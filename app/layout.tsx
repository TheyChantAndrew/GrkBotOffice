import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FamBash HQ",
  description: "Live isometric pixel-art office for the FamBash bots."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
