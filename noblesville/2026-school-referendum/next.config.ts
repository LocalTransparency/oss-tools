import type { NextConfig } from "next";

const basePath = "/tools/2026-school-referendum";

const nextConfig: NextConfig = {
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
