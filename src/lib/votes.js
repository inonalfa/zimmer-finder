import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createVoteStore } from "@/storage/votes";
import { t, collator } from "@/i18n";

const NAME_KEY = "zimmer_voter_name";
let store;
const getStore = () => (store ||= createVoteStore());
const POLL_MS = 30000;

export const cleanName = (s) =>
  String(s || "")
    .replace(/\s+/g, " ")
    .trim();
export const MAX_NAME = 30;

const readName = () => {
  try {
    return cleanName(localStorage.getItem(NAME_KEY)) || "";
  } catch (e) {
    return "";
  }
};

// Votes (pluggable store, see src/storage/votes.js) + local display-name identity.
export function useVotes() {
  const [votes, setVotes] = useState([]);
  const [myName, setMyNameState] = useState(readName);
  const [pending, setPending] = useState({}); // slug -> optimistic vote ("like" | "unlike" | null)
  const [error, setError] = useState(null);
  const busy = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const data = await getStore().list();
      if (busy.current === 0) setVotes(Array.isArray(data) ? data : []);
    } catch (e) {
      /* keep last known votes */
    }
  }, []);

  useEffect(() => {
    refresh();
    const tick = () => document.visibilityState === "visible" && refresh();
    const id = setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const setMyName = useCallback((n) => {
    const v = cleanName(n).slice(0, MAX_NAME);
    try {
      v ? localStorage.setItem(NAME_KEY, v) : localStorage.removeItem(NAME_KEY);
    } catch (e) {}
    setMyNameState(v);
  }, []);

  // slug -> { likes: [names], unlikes: [names], mine: "like" | "unlike" | null }
  const bySlug = useMemo(() => {
    const m = new Map();
    const seen = new Set();
    for (const v of votes) {
      if (!v || !v.zimmer_slug || !v.voter_name || (v.vote !== "like" && v.vote !== "unlike")) continue;
      const key = v.zimmer_slug + "\u0000" + v.voter_name;
      if (seen.has(key)) continue; // list is newest first; keep one vote per (slug, name)
      seen.add(key);
      if (!m.has(v.zimmer_slug)) m.set(v.zimmer_slug, { likes: [], unlikes: [], mine: null });
      const e = m.get(v.zimmer_slug);
      (v.vote === "like" ? e.likes : e.unlikes).push(v.voter_name);
      if (myName && v.voter_name === myName) e.mine = v.vote;
    }
    // apply optimistic changes for the current user
    for (const [slug, vote] of Object.entries(pending)) {
      if (!myName) continue;
      const e = m.get(slug) || { likes: [], unlikes: [], mine: null };
      e.likes = e.likes.filter((n) => n !== myName);
      e.unlikes = e.unlikes.filter((n) => n !== myName);
      if (vote === "like") e.likes = [...e.likes, myName];
      if (vote === "unlike") e.unlikes = [...e.unlikes, myName];
      e.mine = vote;
      m.set(slug, e);
    }
    for (const e of m.values()) {
      e.likes.sort((a, b) => collator.compare(a, b));
      e.unlikes.sort((a, b) => collator.compare(a, b));
    }
    return m;
  }, [votes, pending, myName]);

  const infoFor = useCallback((slug) => bySlug.get(slug) || { likes: [], unlikes: [], mine: null }, [bySlug]);

  // vote: "like" | "unlike" | null (clear). Requires myName.
  const cast = useCallback(
    async (slug, vote, name = myName) => {
      if (!slug || !name) return false;
      setError(null);
      busy.current++;
      setPending((p) => ({ ...p, [slug]: vote }));
      let ok = true;
      try {
        await getStore().cast(slug, name, vote || null);
      } catch (e) {
        ok = false;
        setError(t("Could not save your vote. Please try again."));
      } finally {
        busy.current--;
        if (busy.current === 0) {
          try {
            const data = await getStore().list();
            setVotes(Array.isArray(data) ? data : []);
          } catch (e) {}
          setPending({});
        }
      }
      return ok;
    },
    [myName],
  );

  const myLikedCount = useMemo(() => {
    let n = 0;
    for (const e of bySlug.values()) if (e.mine === "like") n++;
    return n;
  }, [bySlug]);

  return { votes, infoFor, cast, myName, setMyName, myLikedCount, error, clearError: () => setError(null), refresh };
}

// Zimmer counts as "unliked" (dimmed / hidden by the filter) when I unliked it,
// or when it has more unlike votes than like votes.
export const isUnliked = (info) => info.mine === "unlike" || (info.mine !== "like" && info.unlikes.length > info.likes.length);

// Couple match: at least 2 different voters liked it and nobody unliked it.
export const isMatch = (info) => !!info && new Set(info.likes).size >= 2 && info.unlikes.length === 0;
