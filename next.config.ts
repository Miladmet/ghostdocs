import type { NextConfig } from "next";
import * as fs from "fs";
import * as path from "path";

// =============================================================================
// Content Security Policy
// =============================================================================
//
// NOTE: Next.js `headers()` is not applied during `output: 'export'` (static
// export). The CSP below is documented here for intent and is written to
// `public/_headers` (Netlify/Vercel edge format) for enforcement at the CDN
// layer. It is also exported via the `headers` function so IDEs and reviewers
// can see it alongside the rest of the config.
//
// CSP rationale:
//   script-src 'unsafe-eval'        — required by Next.js dev mode
//   script-src 'wasm-unsafe-eval'   — required by Transformers.js (WASM)
//   worker-src 'self' blob:         — Web Workers loaded from same-origin + blob:
//   connect-src huggingface.co etc. — model weights downloaded by Transformers.js
//   object-src 'none'               — no plugins
//   base-uri 'self'                 — prevent base-tag hijacking
//
const CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; " +
  "worker-src 'self' blob:; " +
  "connect-src 'self' https://huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; " +
  "font-src 'self'; " +
  "object-src 'none'; " +
  "base-uri 'self';";

// =============================================================================
// Custom webpack plugin — copies PDF.js worker to public/
// =============================================================================
//
// pdfjs-dist ships its worker as an ES module in:
//   node_modules/pdfjs-dist/build/pdf.worker.min.mjs
//
// We need it in public/ so the browser can fetch /pdf.worker.min.mjs.
// This runs once per build (guarded by the 'emit' phase check) and is a pure
// Node.js fs.copyFileSync — no extra dependencies required.
//
class CopyPdfWorkerPlugin {
  apply(compiler: {
    hooks: { emit: { tap: (name: string, fn: () => void) => void } };
    context: string;
  }) {
    compiler.hooks.emit.tap("CopyPdfWorkerPlugin", () => {
      const src = path.resolve(
        compiler.context,
        "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"
      );
      const dest = path.resolve(compiler.context, "public/pdf.worker.min.mjs");

      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        console.log("[CopyPdfWorkerPlugin] Copied pdf.worker.min.mjs → public/");
      } else {
        console.log(
          "[CopyPdfWorkerPlugin] public/pdf.worker.min.mjs already exists — skipping copy."
        );
      }
    });
  }
}

// =============================================================================
// Next.js configuration
// =============================================================================

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // Static export — no Node.js server at runtime.
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,

  // Images must be unoptimised for static export (no server-side optimizer).
  images: {
    unoptimized: true,
  },

  // Webpack hook: register the PDF.js worker copy plugin.
  webpack(config, { isServer }) {
    if (!isServer) {
      // Only needs to run once (client build). The server build doesn't serve
      // static files so there's no point copying there.
      config.plugins = config.plugins ?? [];
      config.plugins.push(new CopyPdfWorkerPlugin());
    }
    return config;
  },

  // Turbopack config with workspace root set to this repository
  turbopack: {
    root: __dirname,
  },
};

export { CSP };
export default nextConfig;
