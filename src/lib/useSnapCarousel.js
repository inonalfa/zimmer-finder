import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Native scroll-snap carousel helper. Works in RTL (negative scrollLeft) and LTR.
export function useSnapCarousel(count, startIndex = 0) {
  const ref = useRef(null);
  const [index, setIndex] = useState(startIndex);
  const raf = useRef(0);

  const sign = () => {
    const el = ref.current;
    return el && getComputedStyle(el).direction === "rtl" ? -1 : 1;
  };

  const goTo = useCallback(
    (i, smooth = true) => {
      const el = ref.current;
      if (!el || !count) return;
      const n = ((i % count) + count) % count;
      el.scrollTo({ left: sign() * n * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
      setIndex(n);
    },
    [count],
  );

  const onScroll = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el || !el.clientWidth) return;
      const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
      setIndex(Math.max(0, Math.min(count - 1, i)));
    });
  }, [count]);

  useLayoutEffect(() => {
    if (startIndex) goTo(startIndex, false);
  }, []);

  // keep the current slide aligned after resize / rotation
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== w) {
        w = el.clientWidth;
        el.scrollTo({ left: sign() * index * el.clientWidth, behavior: "auto" });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [index]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return {
    ref,
    index,
    goTo,
    next: () => goTo(index + 1),
    prev: () => goTo(index - 1),
    onScroll,
  };
}
