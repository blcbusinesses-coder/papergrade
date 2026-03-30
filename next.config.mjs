/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse uses Node.js built-ins that need to be excluded from bundling
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent webpack from trying to bundle native node modules used by pdf-parse
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "canvas",
      ];
    }
    return config;
  },
  // Ensure server-only packages aren't attempted on the client
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
};

export default nextConfig;
