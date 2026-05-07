/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow next/image to load mockups from MinIO (dev) and S3 (prod).
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "9000" },
      { protocol: "http", hostname: "minio", port: "9000" },
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      { protocol: "https", hostname: "*.s3.*.amazonaws.com" },
    ],
  },
};

export default nextConfig;
