import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Libre_Franklin } from "next/font/google";
import "./globals.css";

// Variable con tamaño óptico: trazos finos en titulares, robustos en cifras pequeñas.
const display = Bodoni_Moda({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
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
  themeColor: "#17130F",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO">
      <body className={`${display.variable} ${text.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
