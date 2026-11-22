import type { Metadata } from "next";

export const APP_NAME = "Milestone";
export const APP_DESCRIPTION = "Trustless milestone-based escrow on Stellar";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://milestonepay.app";
export const APP_ICON_PATH = "/app-icon.svg";
export const APP_ICON_URL = `${APP_URL}${APP_ICON_PATH}`;

export const APP_METADATA: Metadata = {
  title: {
    default: `${APP_NAME} Escrow`,
    template: `%s · ${APP_NAME} Escrow`,
  },
  description: APP_DESCRIPTION,
  icons: { icon: APP_ICON_PATH },
  openGraph: {
    type: "website",
    siteName: `${APP_NAME} Escrow`,
    title: `${APP_NAME} Escrow`,
    description: APP_DESCRIPTION,
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: `${APP_NAME} Escrow` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} Escrow`,
    description: APP_DESCRIPTION,
    images: ["/og-image.svg"],
  },
};

export const WALLETCONNECT_METADATA = {
  name: APP_NAME,
  description: APP_DESCRIPTION,
  url: APP_URL,
  icons: [APP_ICON_URL],
};
