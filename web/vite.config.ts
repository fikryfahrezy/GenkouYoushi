import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ORT_RUNTIME_FILES = [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
];

function runtimeFile(filename: string): Buffer {
  return readFileSync(resolve("node_modules/onnxruntime-web/dist", filename));
}

export default defineConfig({
  plugins: [
    solid(),
    {
      name: "copy-onnx-wasm-runtime",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const filename = ORT_RUNTIME_FILES.find(
            (candidate) => request.url === `/ort/${candidate}`,
          );
          if (!filename) {
            next();
            return;
          }
          response.statusCode = 200;
          response.setHeader(
            "Content-Type",
            filename.endsWith(".wasm") ? "application/wasm" : "text/javascript",
          );
          response.end(runtimeFile(filename));
        });
      },
      generateBundle() {
        for (const filename of ORT_RUNTIME_FILES) {
          this.emitFile({
            type: "asset",
            fileName: `ort/${filename}`,
            source: runtimeFile(filename),
          });
        }
      },
    },
  ],
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
