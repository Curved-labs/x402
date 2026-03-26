import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "crif",
    short_name: "crif",
    description:
      "Transaction legibility engine for Solana. Decodes instructions, diffs state, detects the Drift 2026 exploit pattern.",
    start_url: "/",
    display: "standalone",
    background_color: "#070709",
    theme_color: "#070709",
    orientation: "any",
    lang: "en",
    dir: "ltr",
    categories: ["developer", "security", "utilities"],
    icons: [
      {
        src: "/icon",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
