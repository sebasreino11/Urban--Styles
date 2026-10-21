import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Todas las páginas dependen del tenant (host) o de la sesión: se
  // renderizan por request. Sin cacheComponents/PPR el modelo es más simple
  // de mantener y no hace falta caché incremental en R2.
  cacheComponents: false,
  // Sin optimizador de imágenes: en Cloudflare es un servicio de pago.
  images: { unoptimized: true },
  poweredByHeader: false,
  // Headers básicos de seguridad. Referrer-Policy evita que el token de
  // /cita/[token] se filtre a sitios externos (Maps, Instagram, WhatsApp).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
