import { describe, expect, it, vi } from "vitest";
import { localStore, supabaseStore, createVoteStore } from "./votes";
import { loadJson } from "./data";
import { isMatch, isUnliked } from "@/lib/votes";

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

describe("local vote store", () => {
  it("keeps one vote per person and clears", async () => {
    const s = localStore({ trip_id: "t" }, memory());
    await s.cast("a", "Dana", "like");
    await s.cast("a", "Dana", "unlike");
    await s.cast("a", "Noam", "like");
    let list = await s.list();
    expect(list).toHaveLength(2);
    expect(list.find((v) => v.voter_name === "Dana").vote).toBe("unlike");
    await s.cast("a", "Dana", null);
    list = await s.list();
    expect(list.map((v) => v.voter_name)).toEqual(["Noam"]);
  });
  it("is the default", () => {
    expect(createVoteStore().kind).toBe("local");
  });
});

describe("supabase vote store", () => {
  it("talks to the REST API with the anon key and trip id", async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => [{ zimmer_slug: "a", voter_name: "D", vote: "like" }] }));
    const s = supabaseStore({ url: "https://x.supabase.co/", anon_key: "k", trip_id: "trip 1" }, fetch);
    expect(await s.list()).toHaveLength(1);
    expect(fetch.mock.calls[0][0]).toContain("/rest/v1/zimmer_votes?trip_id=eq.trip%201");
    expect(fetch.mock.calls[0][1].headers.apikey).toBe("k");
    await s.cast("a", "D", "like");
    const [url, opts] = fetch.mock.calls[1];
    expect(url).toContain("on_conflict=trip_id,zimmer_slug,voter_name");
    expect(JSON.parse(opts.body)).toMatchObject({ trip_id: "trip 1", zimmer_slug: "a", voter_name: "D", vote: "like" });
    await s.cast("a", "D", null);
    expect(fetch.mock.calls[2][1].method).toBe("DELETE");
  });
  it("requires url and key", () => {
    expect(() => supabaseStore({})).toThrow(/required/);
  });
});

describe("json data adapter", () => {
  it("resolves relative image paths against the app base", async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [{ slug: "a", image_urls: ["data/images/a/1.jpg", "https://cdn/x.jpg"], thumb_urls: [] }],
    }));
    const [z] = await loadJson({ url: "data/zimmers.json" }, fetch);
    expect(fetch.mock.calls[0][0]).toBe("/data/zimmers.json");
    expect(z.image_urls).toEqual(["/data/images/a/1.jpg", "https://cdn/x.jpg"]);
  });
  it("throws on HTTP errors", async () => {
    await expect(loadJson({}, async () => ({ ok: false, status: 404 }))).rejects.toThrow(/404/);
  });
});

describe("match logic", () => {
  it("needs two different likers and no dislikes", () => {
    expect(isMatch({ likes: ["a", "b"], unlikes: [] })).toBe(true);
    expect(isMatch({ likes: ["a"], unlikes: [] })).toBe(false);
    expect(isMatch({ likes: ["a", "b"], unlikes: ["c"] })).toBe(false);
    expect(isUnliked({ likes: [], unlikes: ["x"], mine: null })).toBe(true);
    expect(isUnliked({ likes: [], unlikes: ["x"], mine: "like" })).toBe(false);
  });
});
