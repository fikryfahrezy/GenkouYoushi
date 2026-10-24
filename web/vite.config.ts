import { defineConfig } from "vite";
import { solidStart } from "@solidjs/start/config";
import { nitro } from "nitro/vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { licenseNotices } from "./license-notices.ts";

const notices = licenseNotices();

const ORT_RUNTIME_ASSETS = [
  {
    source: "ort-wasm-simd-threaded.mjs",
    output: "ort-wasm-simd-threaded.js",
    contentType: "text/javascript",
  },
  {
    source: "ort-wasm-simd-threaded.wasm",
    output: "ort-wasm-simd-threaded.wasm",
    contentType: "application/wasm",
  },
];
const BUILD_ID = Date.now().toString(36);

// Static files, the service worker, and notices belong to the browser build
// only, not to the SSR environment that prerenders the pages.
function isClient(environment: { name: string }): boolean {
  return environment.name === "client";
}

function runtimeFile(filename: string): Buffer {
  return readFileSync(resolve("node_modules/onnxruntime-web/dist", filename));
}

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    solidStart(),
    nitro(),
    { ...notices.main, applyToEnvironment: isClient },
    {
      name: "copy-onnx-wasm-runtime",
      applyToEnvironment: isClient,
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const asset = ORT_RUNTIME_ASSETS.find(
            (candidate) => request.url === `/ort/${candidate.output}`,
          );
          if (!asset) {
            next();
            return;
          }
          response.statusCode = 200;
          response.setHeader("Content-Type", asset.contentType);
          response.end(runtimeFile(asset.source));
        });
      },
      generateBundle() {
        for (const asset of ORT_RUNTIME_ASSETS) {
          this.emitFile({
            type: "asset",
            fileName: `ort/${asset.output}`,
            source: runtimeFile(asset.source),
          });
        }
        const serviceWorker = readFileSync(
          resolve("sw.template.js"),
          "utf8",
        ).replace("__BUILD_ID__", BUILD_ID);
        this.emitFile({
          type: "asset",
          fileName: "app/sw.js",
          source: serviceWorker,
        });
      },
    },
  ],
  worker: { plugins: () => [notices.worker()] },
  nitro: {
    preset: "static",
    prerender: {
      routes: ["/", "/app", "/licenses"],
      failOnError: true,
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
