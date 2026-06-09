/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["http://192.168.18.205:3200", "192.168.18.205", "localhost", "127.0.0.1"],
};

export default nextConfig;
