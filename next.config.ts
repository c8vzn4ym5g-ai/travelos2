import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        destination: "/trips/finland-lapland-winter-journal",
        permanent: true,
        source: "/trips/finland-lapland-winter-journal-2020",
      },
      {
        destination: "/trips/finland-lapland-winter-journal",
        permanent: true,
        source: "/trips/finland-lapland-winter-journal-2019",
      },
    ];
  },
};

export default nextConfig;

// Cloudflare bindings for local `next dev` only. Skip on Vercel/`next build`
// so the existing GitHub → Vercel production path is unchanged.
if (process.env.NODE_ENV === "development" && !process.env.VERCEL && !process.env.CI) {
  void import("@opennextjs/cloudflare").then((mod) => {
    void mod.initOpenNextCloudflareForDev();
  });
}
