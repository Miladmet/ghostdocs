// scripts/build-gh-pages.js
// Cross-platform build script for GitHub Pages static export.
// Safely sets NEXT_PUBLIC_BASE_PATH without shell-specific whitespace or escaping issues.
// After the build, hoists the CSP <meta> to directly after <meta charset> in every
// emitted HTML file, because a meta CSP only applies to content that follows it.

const fs = require('fs');
const path = require('path');

// Matches a whole <meta ...> tag, honouring quoted attribute values (which may contain ">").
const META_TAG_RE =
  /<meta(?:\s+[^\s>"'=/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*\s*\/?>/gi;
const ATTR_RE = /([^\s>"'=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;

/** Returns the attributes of a meta tag as lowercase-name -> value. */
function parseAttrs(tag) {
  const attrs = new Map();
  const inner = tag.replace(/^<meta/i, '').replace(/\/?>$/, '');
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(inner)) !== null) {
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
    attrs.set(m[1].toLowerCase(), value);
  }
  return attrs;
}

function isCspMeta(tag) {
  const v = parseAttrs(tag).get('http-equiv');
  return v !== undefined && v.trim().toLowerCase() === 'content-security-policy';
}

function isCharsetMeta(tag) {
  return parseAttrs(tag).has('charset');
}

/** Lists all meta tags with their positions. */
function findMetas(html) {
  const out = [];
  let m;
  META_TAG_RE.lastIndex = 0;
  while ((m = META_TAG_RE.exec(html)) !== null) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * Moves the CSP meta tag to immediately after the charset meta tag.
 * The tag text is moved verbatim. Throws if the CSP or charset meta is missing,
 * or if more than one CSP meta exists.
 */
function hoistCspMeta(html) {
  const metas = findMetas(html);
  const csps = metas.filter((t) => isCspMeta(t.text));
  if (csps.length === 0) {
    throw new Error('hoistCspMeta: no Content-Security-Policy meta tag found');
  }
  if (csps.length > 1) {
    throw new Error(`hoistCspMeta: expected exactly 1 Content-Security-Policy meta tag, found ${csps.length}`);
  }
  const csp = csps[0];
  const charsets = metas.filter((t) => isCharsetMeta(t.text));
  if (charsets.length === 0) {
    throw new Error('hoistCspMeta: no <meta charset> tag found');
  }
  const charset = charsets[0];

  // Already directly after charset: unchanged.
  if (csp.start === charset.end) return html;

  const without = html.slice(0, csp.start) + html.slice(csp.end);
  const charsetEnd = csp.start < charset.start ? charset.end - csp.text.length : charset.end;
  return without.slice(0, charsetEnd) + csp.text + without.slice(charsetEnd);
}

/** Recursively lists .html files under dir. */
function listHtmlFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listHtmlFiles(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) result.push(full);
  }
  return result;
}

function assertCspFirst(html, file) {
  const csp = findMetas(html).find((t) => isCspMeta(t.text));
  if (!csp) throw new Error(`${file}: CSP meta missing after hoist`);
  const script = html.search(/<script/i);
  const link = html.search(/<link/i);
  if (script !== -1 && csp.start > script) {
    throw new Error(`${file}: CSP meta (index ${csp.start}) is not before the first <script (index ${script})`);
  }
  if (link !== -1 && csp.start > link) {
    throw new Error(`${file}: CSP meta (index ${csp.start}) is not before the first <link (index ${link})`);
  }
}

/** Applies hoistCspMeta to every .html file under dir. Returns { processed, changed }. */
function hoistCspInDir(dir) {
  const files = listHtmlFiles(dir);
  let changed = 0;
  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    let updated;
    try {
      updated = hoistCspMeta(original);
    } catch (err) {
      throw new Error(`${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
    assertCspFirst(updated, file);
    if (updated !== original) {
      fs.writeFileSync(file, updated, 'utf8');
      changed += 1;
    }
  }
  return { processed: files.length, changed };
}

module.exports = { hoistCspMeta, hoistCspInDir };

if (require.main === module) {
  try {
    process.env.NEXT_PUBLIC_BASE_PATH = '/ghostdocs';
    const { execSync } = require('child_process');

    console.log('[build-gh-pages] Building Next.js static export with basePath: /ghostdocs');
    execSync('npx next build', { stdio: 'inherit', env: process.env });
    console.log('[build-gh-pages] Build complete.');

    const { processed, changed } = hoistCspInDir(path.join(__dirname, '..', 'out'));
    console.log(`[build-gh-pages] Hoisted CSP meta in ${changed}/${processed} HTML files.`);
  } catch (err) {
    console.error('[build-gh-pages] Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
