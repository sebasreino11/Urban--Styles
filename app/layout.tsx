import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Libre_Franklin } from "next/font/google";
import "./globals.css";

const display = Big_Shoulders({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "800", "900"],
  display: "swap",
});

const text = Libre_Franklin({
  variable: "--font-text",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Urban Styles · Reserva tu cita", template: "%s · Urban Styles" },
  description: "Reserva tu corte en línea, sin cuentas ni contraseñas.",
};

export const viewport: Viewport = {
  themeColor: "#2A241E",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO">
      <body className={`${display.variable} ${text.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
