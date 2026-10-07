import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  validateRecords,
  parseRecords,
  toRawUrl,
  loadFromUrl,
  embeddedRecords,
  saveCustom,
  readCustom,
  clearCustom,
  loadAll,
} from "./data";

describe("validateRecords / parseRecords", () => {
  it("accepts arrays and { zimmers }, fills missing slugs, drops invalid rows", () => {
    const { records, errors } = validateRecords({
      zimmers: [{ name: "Oak Cabin" }, { slug: "x" }, null, { slug: "a", name: "A", image_urls: "one.jpg" }],
    });
    expect(records.map((r) => r.slug)).toEqual(["oak-cabin", "a"]);
    expect(records[1].image_urls).toEqual(["one.jpg"]);
    expect(errors).toHaveLength(2);
  });
  it("dedupes slugs", () => {
    expect(
      validateRecords([
        { slug: "a", name: "A" },
        { slug: "a", name: "B" },
      ]).records.map((r) => r.slug),
    ).toEqual(["a", "a-2"]);
  });
  it("tolerates a ```json fence and reports bad JSON", () => {
    expect(parseRecords('```json\n[{"name":"A"}]\n```').records).toHaveLength(1);
    expect(parseRecords("{oops").errors[0]).toMatch(/Invalid JSON/);
    expect(parseRecords('"text"').errors[0]).toMatch(/array/);
  });
});

describe("URLs", () => {
  it("turns GitHub and Gist pages into raw links", () => {
    expect(toRawUrl("https://github.com/u/r/blob/main/data/zimmers.json")).toBe(
      "https://raw.githubusercontent.com/u/r/main/data/zimmers.json",
    );
    expect(toRawUrl("https://gist.github.com/u/0123abcd")).toBe("https://gist.githubusercontent.com/u/0123abcd/raw");
    expect(toRawUrl("https://example.com/z.json")).toBe("https://example.com/z.json");
  });
  it("loads with CORS, resolves relative images against the JSON URL", async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify([{ name: "A", image_urls: ["data/images/a/1.jpg", "https://cdn/x.jpg"] }]),
    }));
    const r = await loadFromUrl("https://github.com/u/r/blob/main/data/zimmers.json", fetch);
    expect(fetch.mock.calls[0][1]).toMatchObject({ mode: "cors", credentials: "omit" });
    expect(r.records[0].image_urls).toEqual(["https://raw.githubusercontent.com/u/r/main/data/images/a/1.jpg", "https://cdn/x.jpg"]);
  });
  it("rejects non-http and empty data", async () => {
    await expect(loadFromUrl("javascript:alert(1)")).rejects.toThrow(/http/);
    await expect(loadFromUrl("https://x/y", async () => ({ ok: true, text: async () => "[]" }))).rejects.toThrow();
    await expect(loadFromUrl("https://x/y", async () => ({ ok: false, status: 404 }))).rejects.toThrow(/404/);
  });
});

describe("embedded and custom data", () => {
  beforeEach(() => {
    localStorage.clear();
    document.getElementById("zimmer-data")?.remove();
  });
  it("reads data embedded by the single-file bundle", () => {
    expect(embeddedRecords()).toBeNull();
    const s = document.createElement("script");
    s.id = "zimmer-data";
    s.type = "application/json";
    s.textContent = '[{"slug":"e","name":"E"}]';
    document.head.appendChild(s);
    expect(embeddedRecords()[0].slug).toBe("e");
  });
  it("persists loaded data", () => {
    saveCustom([{ slug: "c", name: "C" }], "file.json");
    expect(readCustom()).toEqual({ source: "file.json", records: [{ slug: "c", name: "C" }] });
    clearCustom();
    expect(readCustom()).toBeNull();
  });
  it("loadAll prefers ?data= over everything", async () => {
    saveCustom([{ slug: "c", name: "C" }], "file.json");
    globalThis.fetch = vi.fn(async () => ({ ok: true, text: async () => '[{"slug":"u","name":"U"}]' }));
    const r = await loadAll(undefined, { search: "?data=https%3A%2F%2Fexample.com%2Fz.json" });
    expect(r.source).toBe("url");
    expect(r.records[0].slug).toBe("u");
    const c = await loadAll(undefined, { search: "" });
    expect(c.source).toBe("custom");
  });
});
