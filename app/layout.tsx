import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Belief Updating Study",
  description: "Interactive prototype for a study of belief authorship and belief updating.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="scheme-light">
      <body className="min-w-80 bg-[#fbfbfa] bg-[radial-gradient(circle_at_50%_-20%,rgba(229,224,233,0.52),transparent_34rem)] font-[Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] tracking-normal text-[#2c2c2b] antialiased">
        {children}
      </body>
    </html>
  );
}
