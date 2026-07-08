import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ─ Build & Minification
  swcMinify: true, // Use SWC for faster minification
  
  // ─ Production optimizations
  productionBrowserSourceMaps: false, // Disable source maps in production for smaller bundle
  
  // ─ Compression & Performance
  compress: true, // Enable gzip compression for all responses
  
  // ─ Experimental features for better performance
  experimental: {
    optimizePackageImports: ["@libsql/client"], // Tree-shake unused exports
  },
  
  // ─ Image optimization (in case added later)
  images: {
    unoptimized: false, // Use Next.js Image Optimization
    formats: ["image/avif", "image/webp"], // Modern formats
  },
  
  // ─ Headers for caching
  async headers() {
    return [
      {
        source: "/public/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
