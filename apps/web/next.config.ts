import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@superos/context-engine",
    "@superos/db",
    "@superos/model-registry",
    "@superos/queue",
    "@superos/shared",
    "@superos/storage",
    "@superos/workflow-engine",
  ],
};

export default nextConfig;
