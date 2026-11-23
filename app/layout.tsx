import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "./context/WalletContext";
import { ToastProvider } from "./context/ToastContext";
import Toast from "./components/Toast";
import WalletOverlays from "./components/WalletOverlays";
import GasEstimationWarningBanner from "./components/GasEstimationWarningBanner";

export const metadata: Metadata = {
  title: "Milestone Escrow",
  description: "Trustless milestone-based escrow on Stellar",
};

/**
 * Route-agnostic shell. Fonts are declared in the (marketing) and (app)
 * layouts so each exported page only preloads the families it renders (#863).
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <WalletProvider>
            <GasEstimationWarningBanner className="mx-4 mt-4" />
            {children}
            <Toast />
            <WalletOverlays />
          </WalletProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
