/** @type {import('next').NextConfig} */
const nextConfig = {
  // Raise the body size limit for the verify API route so larger label
  // photos can be posted (images are downscaled client-side first, but
  // give some headroom for batch uploads).
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
