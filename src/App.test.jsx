import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "./App";

vi.mock("@/components/MapView", () => ({ default: () => <div>map</div> }));

const zimmers = [
  {
    slug: "a",
    name: "Alpha (example)",
    region: "North",
    town: "T1",
    price_total: 3000,
    jacuzzi_indoor: true,
    jacuzzi_outdoor: true,
    availability_status: "verified",
    score: 1,
    phone: "050-000-0001",
  },
  { slug: "b", name: "Beta (example)", region: "South", town: "T2", price_total: 5000, score: 2 },
  { slug: "c", name: "Gamma (example)", region: "North", town: "T3", price_total: 4000, availability_status: "unavailable", score: 3 },
];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => zimmers }));
  window.scrollTo = () => {};
});

describe("App", () => {
  it("renders cards from data/zimmers.json and moves sold-out ones to their own section", async () => {
    render(<App />);
    expect(await screen.findByText("Alpha (example)")).toBeInTheDocument();
    expect(screen.getByText("Beta (example)")).toBeInTheDocument();
    expect(screen.queryByText("Gamma (example)")).not.toBeInTheDocument();
    expect(screen.getByText("Already booked (1)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Zimmer Finder");
  });

  it("filters to indoor + outdoor jacuzzi", async () => {
    render(<App />);
    await screen.findByText("Alpha (example)");
    fireEvent.click(screen.getAllByRole("switch")[0]);
    expect(screen.queryByText("Beta (example)")).not.toBeInTheDocument();
  });

  it("asks for a name before the first vote, then stores the like", async () => {
    render(<App />);
    await screen.findByText("Alpha (example)");
    fireEvent.click(screen.getAllByTitle("Like")[0]);
    const input = await screen.findByPlaceholderText("e.g. Dana");
    fireEvent.change(input, { target: { value: "Dana" } });
    fireEvent.click(screen.getByText("Save"));
    await vi.waitFor(() => expect(localStorage.getItem("zimmer_votes:default")).toContain("Dana"));
  });

  it("opens the detail view from the URL hash", async () => {
    window.history.replaceState(null, "", "/#b");
    render(<App />);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByText(/Beta \(example\)/).length).toBeGreaterThan(0);
  });
});

describe("viewer mode", () => {
  it("loads pasted JSON from the Load data dialog and keeps it", async () => {
    render(<App />);
    await screen.findByText("Alpha (example)");
    fireEvent.click(screen.getAllByText("Load data")[0]);
    fireEvent.change(screen.getByLabelText(/paste the JSON/), {
      target: { value: '[{"slug":"p","name":"Pasted Cabin","price_total":1900}]' },
    });
    fireEvent.click(screen.getByText("Show places"));
    expect(await screen.findByText("Pasted Cabin")).toBeInTheDocument();
    expect(screen.queryByText("Alpha (example)")).not.toBeInTheDocument();
    expect(screen.getByTestId("data-banner")).toHaveTextContent("pasted data");
    expect(localStorage.getItem("zimmer_custom_data")).toContain("Pasted Cabin");
  });

  it("shows an error for invalid pasted JSON", async () => {
    render(<App />);
    await screen.findByText("Alpha (example)");
    fireEvent.click(screen.getAllByText("Load data")[0]);
    fireEvent.change(screen.getByLabelText(/paste the JSON/), { target: { value: "not json" } });
    fireEvent.click(screen.getByText("Show places"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid JSON");
  });

  it("loads ?data= from a URL", async () => {
    window.history.replaceState(null, "", "/?data=" + encodeURIComponent("https://example.com/z.json"));
    globalThis.fetch = vi.fn(async () => ({ ok: true, text: async () => '[{"slug":"r","name":"Remote Cabin"}]' }));
    render(<App />);
    expect(await screen.findByText("Remote Cabin")).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toBe("https://example.com/z.json");
  });
});
