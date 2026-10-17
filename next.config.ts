import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Todas las páginas dependen del tenant (host) o de la sesión: se
  // renderizan por request. Sin cacheComponents/PPR el modelo es más simple
  // de mantener y no hace falta caché incremental en R2.
  cacheComponents: false,
  // Sin optimizador de imágenes: en Cloudflare es un servicio de pago.
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
