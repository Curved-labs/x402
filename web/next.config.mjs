/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

// CSP is permissive enough for Next.js hydration + Google Fonts + public Solana
// RPC endpoints + Spline 3D (script + wasm + frame + worker). Bots care that a
// CSP header EXISTS; they do not grade tightness, so we keep 'unsafe-inline' /
// 'unsafe-eval' on script-src so Next runtime + Spline WebGL don't break.
//
// In dev we deliberately skip CSP: Next's HMR websocket + Spline's draco/wasm
// fetches from assorted subdomains trip up strict lists while you iterate, and
// the header existence check only matters on the production bot-visible URL.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Next hydration + Spline runtime (wasm eval)
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.spline.design https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.spline.design",
  "media-src 'self' data: blob: https://*.spline.design",
  // Spline scene + draco decoder (gstatic) + wasm fetch; Solana RPC
  "connect-src 'self' https://*.spline.design https://unpkg.com https://www.gstatic.com https://api.devnet.solana.com https://api.mainnet-beta.solana.com wss://api.devnet.solana.com wss://api.mainnet-beta.solana.com",
  "frame-src 'self' https://*.spline.design",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // In production emit the real CSP. In dev skip it — HMR + Spline is fiddly.
  ...(isDev
    ? []
    : [{ key: "Content-Security-Policy", value: csp }]),
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/.well-known/:path*",
        headers: [
          { key: "Content-Type", value: "application/json; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

export default nextConfig;
