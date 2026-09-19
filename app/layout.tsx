import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  IBM_Plex_Mono,
  Instrument_Serif,
  Inter,
} from "next/font/google";
import "./globals.css";
import { WalletProvider } from "./context/WalletContext";
import { ToastProvider } from "./context/ToastContext";
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

// Landing page typefaces. Self-hosted through next/font rather than a
// <link> to Google Fonts: the image is served by nginx with no guarantee of
// outbound font access, so the files ship with the bundle and subset here.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
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
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
      </body>
    </html>
  );
}
