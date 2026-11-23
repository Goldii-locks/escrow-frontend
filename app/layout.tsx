import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "./context/ToastContext";
import Toast from "./components/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Milestone Escrow",
    template: "%s · Milestone Escrow",
  },
  description: "Trustless milestone-based escrow on Stellar",
  openGraph: {
    type: "website",
    siteName: "Milestone Escrow",
    title: "Milestone Escrow",
    description: "Trustless milestone-based escrow on Stellar",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Milestone Escrow" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Milestone Escrow",
    description: "Trustless milestone-based escrow on Stellar",
    images: ["/og-image.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          {children}
          <Toast />
        </ToastProvider>
      </body>
    </html>
  );
}
