import { defineConfig } from "vite";
import { renameSync } from "node:fs";
import { resolve } from "node:path";
import preact from "@preact/preset-vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// vite-plugin-singlefile always inlines everything into whatever the html
// entry point is named (index.html, per Vite convention). We rename the
// emitted file post-build so the shipped artifact matches the spec's
// dist/cope-processor.html filename without disturbing the dev entry.
function renameToCopeProcessor() {
  return {
    name: "rename-to-cope-processor",
    closeBundle() {
      renameSync(
        resolve(__dirname, "dist/index.html"),
        resolve(__dirname, "dist/cope-processor.html")
      );
    }
  };
}

export default defineConfig({
  plugins: [preact(), viteSingleFile(), renameToCopeProcessor()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false
  }
});
