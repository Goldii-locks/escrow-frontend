import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "./context/WalletContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";
import Toast from "./components/Toast";
import LedgerLoaderOverlay from "./components/LedgerLoaderOverlay";
import WalletLoaderOverlay from "./components/WalletLoaderOverlay";
import GasEstimationWarningBanner from "./components/GasEstimationWarningBanner";
import SignatureTimeoutAlert from "./components/SignatureTimeoutAlert";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Milestone Escrow",
  description: "Trustless milestone-based escrow on Stellar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <NotificationProvider>
            <ToastProvider>
              <WalletProvider>
                <GasEstimationWarningBanner className="mx-4 mt-4" />
                <SignatureTimeoutAlert />
                {children}
                <Toast />
                <LedgerLoaderOverlay />
                <WalletLoaderOverlay />
              </WalletProvider>
            </ToastProvider>
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
