import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@xyflow/react"],
  /** Playwright uses `http://127.0.0.1:80`; dev middleware blocks cross-origin HMR without this. */
  allowedDevOrigins: ["dailify.local", "127.0.0.1", "localhost"],
}

export default nextConfig
