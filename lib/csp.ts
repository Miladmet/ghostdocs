// Single source of truth for the Content Security Policy.
// Used by the <meta http-equiv> tag in app/layout.tsx and by next.config.ts.
// Must match the Content-Security-Policy line in public/_headers
// (enforced by tests/unit/csp.test.ts).
export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'self';";
