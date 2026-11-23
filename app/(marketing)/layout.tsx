import {
  IBM_Plex_Mono,
  Instrument_Serif,
  Inter,
} from "next/font/google";

// Landing page typefaces. Self-hosted through next/font rather than a <link>
// to Google Fonts: the image is served by nginx with no guarantee of outbound
// font access, so the files ship with the bundle and subset here.
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

/** Only the landing route downloads the three marketing families (#863). */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={`${inter.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable} flex min-h-full flex-1 flex-col`}
    >
      {children}
    </div>
  );
}
