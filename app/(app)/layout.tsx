import { WalletProvider } from "../context/WalletContext";
import WalletLoaderOverlay from "../components/WalletLoaderOverlay";
import GasEstimationWarningBanner from "../components/GasEstimationWarningBanner";
import SignatureTimeoutAlert from "../components/SignatureTimeoutAlert";

// Wallet providers and overlays live here, not in the root layout, so the
// landing page doesn't ship the wallet stack in its first-load JS.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <WalletProvider>
      <GasEstimationWarningBanner className="mx-4 mt-4" />
      <SignatureTimeoutAlert />
      {children}
      <WalletLoaderOverlay />
    </WalletProvider>
  );
}
