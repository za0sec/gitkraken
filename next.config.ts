import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingExcludes: {
    "/*": [
      "./.context/**/*",
      "./.git/**/*",
      "./release/**/*",
      "./build/**/*",
      "./scripts/**/*",
      "./tests/**/*",
      "./test-results/**/*",
      "./.env*",
    ],
  },
};
export default nextConfig;
