import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // AFTERFALL is a static build in public/afterfall; its assets load relative
  // to the page, so send the bare path to the document inside the folder.
  async redirects() {
    return [
      {
        source: "/afterfall",
        destination: "/afterfall/index.html",
        permanent: false,
      },
      {
        source: "/afterfall/",
        destination: "/afterfall/index.html",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        //https://nextjs.org/docs/messages/next-image-unconfigured-host
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
