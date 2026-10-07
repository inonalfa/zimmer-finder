// zimmer-vote: upsert or clear a like/unlike vote for a zimmer.
// The app has no login, so anyone can call this. The function writes with the
// service role (ZimmerVote writes are admin-only in RLS) and validates inputs:
// known active slug, vote in like|unlike|clear, voter name 1-30 chars.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

export default async function (req: Request): Promise<Response> {
  if (req.method !== "POST") return bad("POST only", 405);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad("invalid JSON");
  }

  const slug = typeof body?.zimmer_slug === "string" ? body.zimmer_slug.trim() : "";
  const name = typeof body?.voter_name === "string" ? body.voter_name.replace(/\s+/g, " ").trim() : "";
  const vote = body?.vote;

  if (!slug || slug.length > 120) return bad("invalid zimmer_slug");
  if (!name || [...name].length > 30) return bad("voter_name must be 1-30 characters");
  if (!["like", "unlike", "clear"].includes(vote)) return bad("vote must be like, unlike or clear");

  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole.entities;

    const zimmers = await sr.Zimmer.filter({ slug }, undefined, 1);
    if (!Array.isArray(zimmers) || !zimmers.length) return bad("unknown zimmer", 404);

    const existing = (await sr.ZimmerVote.filter({ zimmer_slug: slug, voter_name: name }, "-updated_date", 50)) || [];
    const [keep, ...dupes] = existing;
    for (const d of dupes) await sr.ZimmerVote.delete(d.id);

    if (vote === "clear") {
      if (keep) await sr.ZimmerVote.delete(keep.id);
      return Response.json({ ok: true, vote: null });
    }
    const rec = { zimmer_slug: slug, voter_name: name, vote, voted_at: new Date().toISOString() };
    const saved = keep ? await sr.ZimmerVote.update(keep.id, rec) : await sr.ZimmerVote.create(rec);
    return Response.json({ ok: true, vote, id: saved?.id ?? keep?.id ?? null });
  } catch (e) {
    return bad(String((e as any)?.message ?? e), 500);
  }
}
