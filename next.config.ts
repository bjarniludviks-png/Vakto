import type { NextConfig } from "next";

// Security headers on every response (HSTS already comes from Vercel).
// Deliberately no script-src CSP yet: it needs a nonce setup to not break
// Next.js inline scripts — only `frame-ancestors` (anti-clickjacking) for now.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // geolocation: the web punch card asks for one position when the company has geofencing on
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
