import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Barlow } from "next/font/google";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const barlow = Barlow({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Órbita Cinema",
  description: "Cadena de cines Órbita Cinema",
  openGraph: {
    title: "Órbita Cinema",
    description: "Cadena de cines Órbita Cinema",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${bebas.variable} ${barlow.variable}`}>
      <body>{children}</body>
    </html>
  );
}
