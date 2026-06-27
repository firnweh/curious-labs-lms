import type { MetadataRoute } from "next";

/**
 * Web app manifest — makes Curious Labs installable to a phone/desktop home
 * screen and gives the installed app its name, icons and cosmic chrome colour.
 * Served by Next at /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Curious Labs — Learn by Doing",
    short_name: "Curious Labs",
    description:
      "Hands-on coding, robotics, AI and 3D labs for grades 1–10. Build in your browser — zero installs.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#060810",
    theme_color: "#060810",
    categories: ["education", "kids"],
    lang: "en",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
