// scripts/build-gh-pages.js
// Cross-platform build script for GitHub Pages static export.
// Safely sets NEXT_PUBLIC_BASE_PATH without shell-specific whitespace or escaping issues.

process.env.NEXT_PUBLIC_BASE_PATH = '/ghostdocs';
const { execSync } = require('child_process');

console.log('[build-gh-pages] Building Next.js static export with basePath: /ghostdocs');
execSync('npx next build', { stdio: 'inherit', env: process.env });
console.log('[build-gh-pages] Build complete.');
