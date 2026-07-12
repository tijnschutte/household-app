import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mandje",
    short_name: "Mandje",
    description: "Boodschappen en geld voor je huishouden",
    start_url: "/",
    display: "standalone",
    background_color: "#1e3a8a",
    theme_color: "#1e3a8a",
    icons: [
      {
        src: "/icon?<generated>",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon?<generated>",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
