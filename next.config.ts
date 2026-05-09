import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@xyflow/react"],
  allowedDevOrigins: ["dailify.local"],
}

export default nextConfig
