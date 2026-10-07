import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { reasonText, featureLabel, votesExport, topFeatures, hasFit } from "./fit";
import { FitBadge, FitReasons, FitSection } from "@/components/Fit";
import TasteView from "@/components/TasteView";
import { loadPreferences } from "@/storage/data";

const z = {
  slug: "a",
  name: "A",
  fit_score: 82.4,
  fit_reasons: [
    { feature: "detached", kind: "match", liked_with: 3, liked_total: 3, unliked_with: 0, unliked_total: 2 },
    { feature: "near_host", kind: "warn", liked_with: 0, liked_total: 3, unliked_with: 2, unliked_total: 2 },
    { feature: "region:Golan Heights", kind: "match", note: "we love the north" },
  ],
};
const prefs = {
  version: 1,
  updated_at: "2026-07-20T09:00:00Z",
  trips: ["t1"],
  voters: ["Dana", "Noam"],
  explicit: [{ feature: "near_host", weight: -1, note: "No hosts next door" }],
  profiles: {
    "*": {
      votes: 5,
      features: {
        detached: { weight: 1.2, confidence: 0.6, liked_with: 3, liked_total: 3, unliked_with: 0, unliked_total: 2 },
        near_host: { weight: -1.8, confidence: 0.6, liked_with: 0, liked_total: 3, unliked_with: 2, unliked_total: 2 },
        pool: { weight: 0.05, confidence: 0.1 },
      },
      numeric: { drive_minutes: { liked_max: 150 } },
    },
  },
  observations: [],
};

describe("fit helpers", () => {
  it("builds readable reasons", () => {
    expect(reasonText(z.fit_reasons[0])).toBe("Detached unit - you liked 3 of 3 places with it");
    expect(reasonText(z.fit_reasons[1])).toBe("Next to the hosts' house - 2 of 2 places you disliked had it");
    expect(reasonText(z.fit_reasons[2])).toBe("Golan Heights area - we love the north");
    expect(featureLabel("unknown_x")).toBe("unknown_x");
    expect(hasFit(z)).toBe(true);
    expect(hasFit({})).toBe(false);
  });
  it("exports only valid votes", () => {
    const out = votesExport(
      [
        { zimmer_slug: "a", voter_name: "Dana", vote: "like", id: 7 },
        { zimmer_slug: "b", voter_name: "Dana", vote: null },
      ],
      "trip-1",
    );
    expect(out.trip_id).toBe("trip-1");
    expect(out.votes).toEqual([{ zimmer_slug: "a", voter_name: "Dana", vote: "like" }]);
  });
  it("sorts features by strength and drops weak ones", () => {
    expect(topFeatures(prefs.profiles["*"]).map((f) => f.feature)).toEqual(["near_host", "detached"]);
  });
});

describe("fit UI", () => {
  it("shows the badge and reasons", () => {
    render(
      <>
        <FitBadge z={z} />
        <FitReasons z={z} max={2} />
      </>,
    );
    expect(screen.getByTestId("fit-badge").textContent).toContain("Fits you 82%");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
  it("renders nothing without a fit score", () => {
    const { container } = render(<FitSection z={{ slug: "x", name: "X" }} />);
    expect(container.innerHTML).toBe("");
  });
  it("taste page lists likes, avoids and exports votes", () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    render(<TasteView prefs={prefs} votes={[{ zimmer_slug: "a", voter_name: "Dana", vote: "like" }]} tripId="t" />);
    expect(screen.getAllByTestId("taste-feature")).toHaveLength(2);
    expect(screen.getByText("No hosts next door")).toBeTruthy();
    fireEvent.click(screen.getByTestId("export-votes"));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
  it("taste page without a profile explains how to start", () => {
    render(<TasteView prefs={null} votes={[]} />);
    expect(screen.getByText(/No taste profile yet/)).toBeTruthy();
  });
});

describe("loadPreferences", () => {
  it("returns null when the file is missing", async () => {
    expect(await loadPreferences(async () => ({ ok: false }))).toBeNull();
  });
  it("reads the file", async () => {
    expect(await loadPreferences(async () => ({ ok: true, json: async () => prefs }))).toEqual(prefs);
  });
  it("prefers the embedded copy", async () => {
    const s = document.createElement("script");
    s.id = "zimmer-prefs";
    s.type = "application/json";
    s.textContent = JSON.stringify({ profiles: {}, embedded: true });
    document.head.appendChild(s);
    expect((await loadPreferences(async () => ({ ok: false }))).embedded).toBe(true);
    s.remove();
  });
});
