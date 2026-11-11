import { defineConfig } from "astro/config";

// GitHub Pages serves project sites from /<repo>/. Override with SITE_URL / BASE_PATH.
export default defineConfig({
  site: process.env.SITE_URL ?? "https://muhammedahmedali.github.io",
  base: process.env.BASE_PATH ?? "/tcg-standings-site",
  trailingSlash: "always",
  // Inline the (small) stylesheet into each page. Pages caches HTML for ~10 min, so a cached page
  // pointing at a hashed CSS file from the previous deploy would 404 and render unstyled.
  build: { inlineStylesheets: "always" },
});
