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
