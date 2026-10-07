#!/usr/bin/env node
// Build ONE self-contained HTML file with the app, data/zimmers.json and the photos inside it.
// Open it by double-click (file://), send it as an attachment, no server or internet needed
// (only the map tiles and fonts load from the internet when available).
//
//   npm run bundle                         -> dist-single/zimmer-finder.html
//   npm run bundle -- --data other.json --out my-trip.html --max-mb 40 --thumbs-only
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const dataFile = resolve(ROOT, opt("data", "data/zimmers.json"));
const out = resolve(ROOT, "dist-single", opt("out", "zimmer-finder.html"));
const maxBytes = Number(opt("max-mb", "60")) * 1024 * 1024;
let thumbsOnly = args.includes("--thumbs-only");

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export function toDataUri(path) {
  const mime = MIME[extname(path).toLowerCase()];
  if (!mime || !existsSync(path)) return null;
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
}

// Replace local image paths with data URIs. Remote URLs are kept as they are.
export function embedImages(records, root, { thumbsOnly = false } = {}) {
  const local = (u) => typeof u === "string" && u && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(u);
  const inline = (u) => (local(u) ? toDataUri(resolve(root, u)) || u : u);
  return records.map((z) => {
    const imgs = Array.isArray(z.image_urls) ? z.image_urls : [];
    const th = Array.isArray(z.thumb_urls) && z.thumb_urls.length === imgs.length ? z.thumb_urls : imgs.map(() => null);
    if (thumbsOnly) return { ...z, image_urls: imgs.map((u, i) => inline(local(u) && th[i] ? th[i] : u)), thumb_urls: [] };
    return { ...z, image_urls: imgs.map(inline), thumb_urls: th.map((u) => (u ? inline(u) : null)) };
  });
}

// JSON inside <script type="application/json">: escape "<" so the data can never close the tag.
export const safeJson = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

export function injectData(html, records) {
  const tag = `<script id="zimmer-data" type="application/json">${safeJson(records)}</script>`;
  return html.includes("</head>") ? html.replace("</head>", `${tag}\n</head>`) : tag + html;
}

function main() {
  if (!existsSync(dataFile)) throw new Error(`data file not found: ${dataFile}`);
  const raw = JSON.parse(readFileSync(dataFile, "utf8"));
  const records = Array.isArray(raw) ? raw : raw.zimmers || [];
  execFileSync(process.execPath, [resolve(ROOT, "node_modules/vite/bin/vite.js"), "build", "--mode", "single", "--logLevel", "warn"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, BASE_PATH: "./" },
  });
  const html = readFileSync(resolve(ROOT, "dist-single/index.html"), "utf8");
  let page = injectData(html, embedImages(records, ROOT, { thumbsOnly }));
  if (!thumbsOnly && Buffer.byteLength(page) > maxBytes) {
    console.warn(`bundle is over ${maxBytes / 1048576} MB with full photos - using thumbnails only`);
    thumbsOnly = true;
    page = injectData(html, embedImages(records, ROOT, { thumbsOnly }));
  }
  writeFileSync(resolve(ROOT, "dist-single/index.html"), page);
  renameSync(resolve(ROOT, "dist-single/index.html"), out);
  console.log(`wrote ${out} (${(statSync(out).size / 1048576).toFixed(1)} MB, ${records.length} places)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
