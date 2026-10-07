// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { embedImages, injectData, safeJson } from "./bundle.mjs";

describe("single-file bundle helpers", () => {
  const root = mkdtempSync(join(tmpdir(), "zf-"));
  mkdirSync(join(root, "data/images/a"), { recursive: true });
  writeFileSync(join(root, "data/images/a/1.jpg"), Buffer.from([0xff, 0xd8, 1]));
  writeFileSync(join(root, "data/images/a/1.thumb.jpg"), Buffer.from([0xff, 0xd8, 2]));
  const recs = [
    { slug: "a", name: "A", image_urls: ["data/images/a/1.jpg", "https://cdn/x.jpg"], thumb_urls: ["data/images/a/1.thumb.jpg", null] },
  ];

  it("inlines local photos as data URIs and keeps remote ones", () => {
    const [z] = embedImages(recs, root);
    expect(z.image_urls[0]).toMatch(/^data:image\/jpeg;base64,/);
    expect(z.image_urls[1]).toBe("https://cdn/x.jpg");
    expect(z.thumb_urls[0]).toMatch(/^data:image\/jpeg/);
  });
  it("can use thumbnails only to keep the file small", () => {
    const [z] = embedImages(recs, root, { thumbsOnly: true });
    expect(z.image_urls[0]).toBe("data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 2]).toString("base64"));
    expect(z.thumb_urls).toEqual([]);
  });
  it("embeds JSON safely in the HTML head", () => {
    expect(safeJson({ a: "</script>" })).not.toContain("</script>");
    const html = injectData("<html><head></head><body></body></html>", [{ slug: "a", name: "</script><b>" }]);
    expect(html).toMatch(/<script id="zimmer-data" type="application\/json">.*<\/script>\n<\/head>/);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});
