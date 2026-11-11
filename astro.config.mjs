import { defineConfig } from "astro/config";

// GitHub Pages serves project sites from /<repo>/. Override with SITE_URL / BASE_PATH.
export default defineConfig({
  site: process.env.SITE_URL ?? "https://muhammedahmedali.github.io",
  base: process.env.BASE_PATH ?? "/tcg-standings-site",
  trailingSlash: "always",
});
