import { describe, it, expect } from "vitest";
import { createRequire } from "module";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import fc from "fast-check";

type BuildScript = {
  hoistCspMeta: (html: string) => string;
  hoistCspInDir: (dir: string) => { processed: number; changed: number };
};

const require = createRequire(import.meta.url);
const { hoistCspMeta, hoistCspInDir } = require("../../scripts/build-gh-pages.js") as BuildScript;

const CHARSET = '<meta charSet="utf-8"/>';
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1"/>';
const LINK_CSS = '<link rel="stylesheet" href="/ghostdocs/_next/static/chunks/a.css" data-precedence="next"/>';
const LINK_PRELOAD = '<link rel="preload" as="script" fetchPriority="low" href="/ghostdocs/_next/static/chunks/b.js"/>';
const SCRIPT1 = '<script src="/ghostdocs/_next/static/chunks/c.js" async=""></script>';
const SCRIPT2 = '<script src="/ghostdocs/_next/static/chunks/d.js" async=""></script>';
const TITLE = "<title>GhostDocs</title>";
const CSP =
  '<meta http-equiv="Content-Security-Policy" content="default-src &#x27;self&#x27;; connect-src &#x27;self&#x27;;"/>';

const wrap = (head: string): string => `<!DOCTYPE html><html><head>${head}</head><body>x</body></html>`;

describe("hoistCspMeta", () => {
  it("moves the CSP meta directly after the charset meta, changing nothing else", () => {
    const input = wrap([CHARSET, VIEWPORT, LINK_CSS, LINK_PRELOAD, SCRIPT1, SCRIPT2, TITLE, CSP].join(""));
    const expected = wrap([CHARSET, CSP, VIEWPORT, LINK_CSS, LINK_PRELOAD, SCRIPT1, SCRIPT2, TITLE].join(""));
    expect(hoistCspMeta(input)).toBe(expected);
  });

  it("is idempotent", () => {
    const input = wrap([CHARSET, VIEWPORT, LINK_CSS, SCRIPT1, CSP].join(""));
    const once = hoistCspMeta(input);
    expect(hoistCspMeta(once)).toBe(once);
  });

  it("throws when the CSP meta is missing", () => {
    expect(() => hoistCspMeta(wrap(CHARSET + VIEWPORT))).toThrow(/no Content-Security-Policy/);
  });

  it("throws when there are two CSP metas", () => {
    expect(() => hoistCspMeta(wrap(CHARSET + CSP + SCRIPT1 + CSP))).toThrow(/exactly 1/);
  });

  it("throws when the charset meta is missing", () => {
    expect(() => hoistCspMeta(wrap(VIEWPORT + CSP))).toThrow(/charset/);
  });

  it("handles reversed attribute order, single quotes and no self-closing slash", () => {
    const csp = `<meta content="default-src &#x27;self&#x27;;" http-equiv="Content-Security-Policy">`;
    const out = hoistCspMeta(wrap([CHARSET, VIEWPORT, SCRIPT1, csp].join("")));
    expect(out).toBe(wrap([CHARSET, csp, VIEWPORT, SCRIPT1].join("")));

    const csp2 = `<meta HTTP-EQUIV='content-security-policy' content='x'/>`;
    const out2 = hoistCspMeta(wrap([CHARSET, SCRIPT1, csp2].join("")));
    expect(out2).toBe(wrap([CHARSET, csp2, SCRIPT1].join("")));
  });
});

describe("hoistCspInDir", () => {
  it("processes nested html files and reports counts", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ghostdocs-hoist-"));
    try {
      fs.mkdirSync(path.join(dir, "nested", "deeper"), { recursive: true });
      const bad = wrap([CHARSET, LINK_CSS, SCRIPT1, CSP].join(""));
      const good = wrap([CHARSET, CSP, LINK_CSS, SCRIPT1].join(""));
      fs.writeFileSync(path.join(dir, "index.html"), bad);
      fs.writeFileSync(path.join(dir, "nested", "deeper", "page.html"), good);
      fs.writeFileSync(path.join(dir, "nested", "note.txt"), "ignored");

      expect(hoistCspInDir(dir)).toEqual({ processed: 2, changed: 1 });
      expect(fs.readFileSync(path.join(dir, "index.html"), "utf8")).toBe(good);
      expect(hoistCspInDir(dir)).toEqual({ processed: 2, changed: 0 });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws naming the file when a page lacks a CSP meta", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ghostdocs-hoist-"));
    try {
      fs.writeFileSync(path.join(dir, "broken.html"), wrap(CHARSET + SCRIPT1));
      expect(() => hoistCspInDir(dir)).toThrow(/broken\.html/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("hoistCspMeta property", () => {
  it("places the CSP right after charset, once, leaving other elements unchanged", () => {
    const elementArb = fc.constantFrom(VIEWPORT, LINK_CSS, LINK_PRELOAD, SCRIPT1, SCRIPT2, TITLE);
    fc.assert(
      fc.property(
        fc.array(elementArb, { maxLength: 12 }),
        fc.nat(),
        (elements, rawPos) => {
          const pos = rawPos % (elements.length + 1);
          const withCsp = [...elements.slice(0, pos), CSP, ...elements.slice(pos)];
          const out = hoistCspMeta(wrap(CHARSET + withCsp.join("")));
          expect(out.includes(CHARSET + CSP)).toBe(true);
          expect(out.split(CSP).length - 1).toBe(1);
          const expected = wrap(CHARSET + CSP + elements.join(""));
          expect(out).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});
