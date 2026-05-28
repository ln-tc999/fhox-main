import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@corpus/sdk"],
  // Strict Mode double-mounts every component in dev. For React Three Fiber this
  // means two WebGL contexts get created per page load; the first one isn't
  // always disposed before the second claims the slot. Over a few Fast Refresh
  // cycles the browser's WebGL context pool fills and the GPU drops the oldest,
  // surfacing as "WebGLRenderer: Context Lost." Disabling here makes dev match
  // prod (which never used Strict Mode double-invocation anyway).
  reactStrictMode: false,
};

export default nextConfig;
