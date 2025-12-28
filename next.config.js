/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tajrib.groopin.io",
        pathname: "/storage/**"
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
        pathname: "/api/**"
      }
    ]
  }
};

module.exports = nextConfig;
