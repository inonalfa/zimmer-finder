import { describe, expect, it } from "vitest";
import {
  availabilityMessage,
  displayPhone,
  finalPrice,
  formatDrive,
  formatPrice,
  isMobileIntl,
  isSoldOut,
  perNight,
  phonesOf,
  photosOf,
  priceChange,
  ratingsOf,
  searchDates,
  waAvailabilityLink,
  waNumberOf,
} from "./zimmer-utils";

describe("prices", () => {
  it("prefers the final total and splits it per night from the config dates", () => {
    expect(finalPrice({ price_total: 3000, price_estimate: 2000 })).toBe(3000);
    expect(finalPrice({ price_estimate: 2000 })).toBe(2000);
    expect(perNight({ price_total: 3000 })).toBe(1000); // example config: 3 nights
    expect(formatPrice(3890)).toMatch(/3,890/);
    expect(formatPrice(undefined)).toBeNull();
  });
  it("detects the last price change", () => {
    const z = {
      price_history: [
        { date: "2026-01-02", total: 900 },
        { date: "2026-01-01", total: 1000 },
      ],
    };
    expect(priceChange(z)).toEqual({ diff: -100, up: false, prev: 1000 });
    expect(priceChange({ price_history: [{ date: "x", total: 1 }] })).toBeNull();
  });
});

describe("phones (region.phone_country_code = 972, mobile prefix 5)", () => {
  it("normalises and spots mobiles", () => {
    expect(phonesOf("050-000-0001; 04-000-0000")).toEqual(["972500000001", "97240000000"]);
    expect(isMobileIntl("972500000001")).toBe(true);
    expect(isMobileIntl("97240000000")).toBe(false);
    expect(displayPhone("972500000001")).toBe("050-0000001");
    expect(waNumberOf({ phone: "04-000-0000" })).toBeNull();
  });
  it("builds a WhatsApp link with the trip from the config", () => {
    const link = waAvailabilityLink({ name: "Oak", phone: "050-000-0001", jacuzzi_indoor: true });
    expect(link).toMatch(/^https:\/\/wa\.me\/972500000001\?text=/);
    const msg = availabilityMessage({ name: "Oak", jacuzzi_outdoor: true });
    expect(msg).toContain("2 adults");
    expect(msg).toContain("(3 nights)");
    expect(msg).toContain("outdoor jacuzzi");
  });
});

describe("misc", () => {
  it("dedupes photos and keeps aligned thumbs", () => {
    expect(photosOf({ image_urls: ["a", "a", "b"], thumb_urls: ["ta", "ta", "tb"] })).toEqual([
      { src: "a", thumb: "ta" },
      { src: "b", thumb: "tb" },
    ]);
    expect(photosOf({ image_urls: ["a"], thumb_urls: [] })).toEqual([{ src: "a", thumb: null }]);
  });
  it("formats drive times", () => {
    expect(formatDrive(45)).toBe("~45 min");
    expect(formatDrive(128)).toBe("~2:08 h");
    expect(formatDrive(null)).toBeNull();
  });
  it("collects ratings", () => {
    const r = ratingsOf({ google_rating: 4.8, google_review_count: 10, booking_rating: 9.1 });
    expect(r.map((x) => x.key)).toEqual(["google", "booking"]);
  });
  it("sold out and most common dates", () => {
    expect(isSoldOut({ is_active: false })).toBe(true);
    expect(isSoldOut({ availability_status: "unavailable" })).toBe(true);
    expect(isSoldOut({})).toBe(false);
    expect(
      searchDates([
        { check_in: "a", check_out: "b" },
        { check_in: "a", check_out: "b" },
        { check_in: "c", check_out: "d" },
      ]),
    ).toEqual({ check_in: "a", check_out: "b" });
  });
});
