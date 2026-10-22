/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(process.env.CF_EXPORT === "1" ? { output: "export", images: { unoptimized: true } } : {}),
};

export default nextConfig;
