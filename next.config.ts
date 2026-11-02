import type { NextConfig } from "next";

// The lab is an all-client WebGL app. Cache Components keeps hidden routes
// mounted via React Activity, which would keep the WebGL context alive, and
// it disables `dynamicParams`. Both are turned off on purpose.
const nextConfig: NextConfig = {
  cacheComponents: false,
  partialPrefetching: false,
  // The dev badge sits over the lab's bottom-left transport controls.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
