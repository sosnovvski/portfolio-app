"use client";

import { useEffect } from "react";

const STAGGER_MS = 120;
const PENDING = "reveal-pending";
const REVEALED = "reveal-in";

/**
 * Hides only the records still below the viewport, after mount. Records in view never flash, and
 * without JavaScript nothing is ever hidden. The delay is set through the CSSOM, which a strict CSP allows.
 */
export function ExperienceReveal() {
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches || !("IntersectionObserver" in window)) {
      return;
    }

    const below = Array.from(document.querySelectorAll<HTMLElement>("#experience .suite")).filter(
      (record) => record.getBoundingClientRect().top >= window.innerHeight,
    );

    const observer = new IntersectionObserver(
      (entries) => {
        let entering = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const record = entry.target as HTMLElement;
          record.style.transitionDelay = `${entering * STAGGER_MS}ms`;
          record.classList.remove(PENDING);
          record.classList.add(REVEALED);
          observer.unobserve(record);
          entering += 1;
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );

    for (const record of below) {
      record.classList.add(PENDING);
      observer.observe(record);
    }

    return () => {
      observer.disconnect();
      for (const record of below) {
        record.classList.remove(PENDING);
      }
    };
  }, []);

  return null;
}
