import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Sin caché incremental en R2: todas las páginas son dinámicas (datos por
// barbería y por usuario), así que no hay ISR que persistir. Esto evita
// depender de R2, que exige método de pago registrado en Cloudflare.
export default defineCloudflareConfig({});
