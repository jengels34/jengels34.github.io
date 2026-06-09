#!/usr/bin/env node
// Dependency-free internal link checker for this static site.
// Verifies that every relative / root-relative href and src in the HTML
// resolves to a file that exists, and that in-page #anchors have a matching id.
// External links (http, https, //, mailto, tel, data) are not fetched.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = resolve(process.argv[2] ?? ".");
const IGNORE_DIRS = new Set([".git", "node_modules", ".github"]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".html")) out.push(p);
  }
  return out;
}

const isExternal = (u) =>
  /^(https?:)?\/\//i.test(u) || /^(mailto:|tel:|data:|javascript:)/i.test(u);

function resolveTarget(htmlFile, link) {
  // strip query/fragment
  let path = link.split("#")[0].split("?")[0];
  if (path === "") return null; // pure fragment, handled separately
  let abs = path.startsWith("/")
    ? join(ROOT, path)
    : resolve(dirname(htmlFile), path);
  if (path.endsWith("/")) abs = join(abs, "index.html");
  return abs;
}

const files = walk(ROOT);
const errors = [];

for (const file of files) {
  const html = readFileSync(file, "utf8");
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const rel = relative(ROOT, file);

  for (const m of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
    const link = m[1].trim();
    if (link === "" || link === "#") continue; // placeholder (e.g. JS-assigned)
    if (isExternal(link)) continue;

    if (link.startsWith("#")) {
      const id = link.slice(1);
      if (!ids.has(id)) errors.push(`${rel}: missing in-page anchor "#${id}"`);
      continue;
    }

    const target = resolveTarget(file, link);
    if (target && !existsSync(target)) {
      errors.push(`${rel}: broken link "${link}" -> ${relative(ROOT, target)} (not found)`);
    }
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} broken link(s) found:\n` + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log(`✓ Link check passed (${files.length} HTML files scanned, no broken internal links).`);
