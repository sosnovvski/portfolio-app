import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExperienceReveal } from "./ExperienceReveal";

type Callback = (entries: { isIntersecting: boolean; target: Element }[]) => void;

let trigger: Callback;
let observed: Element[];
let unobserved: Element[];

class FakeObserver {
  constructor(callback: Callback) {
    trigger = callback;
  }
  observe(element: Element) {
    observed.push(element);
  }
  unobserve(element: Element) {
    unobserved.push(element);
  }
  disconnect() {}
}

function stubMotion(allowed: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: allowed }));
}

function addRecords(tops: number[]): HTMLElement[] {
  const section = document.createElement("section");
  section.id = "experience";
  const records = tops.map((top) => {
    const record = document.createElement("article");
    record.className = "suite";
    record.getBoundingClientRect = () => ({ top }) as DOMRect;
    section.append(record);
    return record;
  });
  document.body.append(section);
  return records;
}

beforeEach(() => {
  observed = [];
  unobserved = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.stubGlobal("innerHeight", 800);
  stubMotion(true);
});

afterEach(() => {
  document.getElementById("experience")?.remove();
  vi.unstubAllGlobals();
});

describe("experience reveal", () => {
  it("hides only records below the viewport, so records in view never flash", () => {
    const [inView, atEdge, below] = addRecords([100, 800, 1500]);
    render(<ExperienceReveal />);

    expect(inView).not.toHaveClass("reveal-pending");
    expect(atEdge).toHaveClass("reveal-pending");
    expect(below).toHaveClass("reveal-pending");
    expect(observed).toEqual([atEdge, below]);
  });

  it("reveals once each, staggered by 120 ms within a batch", () => {
    const [first, second, third] = addRecords([900, 1000, 1100]) as [HTMLElement, HTMLElement, HTMLElement];
    render(<ExperienceReveal />);

    act(() =>
      trigger([
        { isIntersecting: true, target: first },
        { isIntersecting: true, target: second },
        { isIntersecting: false, target: third },
      ]),
    );

    expect(first).toHaveClass("reveal-in");
    expect(first).not.toHaveClass("reveal-pending");
    expect(first.style.transitionDelay).toBe("0ms");
    expect(second.style.transitionDelay).toBe("120ms");
    expect(third).toHaveClass("reveal-pending");
    expect(unobserved).toEqual([first, second]);
  });

  it("does nothing when the visitor prefers reduced motion", () => {
    stubMotion(false);
    const [below] = addRecords([1500]);
    render(<ExperienceReveal />);
    expect(below).not.toHaveClass("reveal-pending");
  });

  it("does nothing without IntersectionObserver", () => {
    Reflect.deleteProperty(window, "IntersectionObserver");
    const [below] = addRecords([1500]);
    render(<ExperienceReveal />);
    expect(below).not.toHaveClass("reveal-pending");
  });

  it("never leaves records hidden after unmount", () => {
    const [below] = addRecords([1500]);
    const { unmount } = render(<ExperienceReveal />);
    unmount();
    expect(below).not.toHaveClass("reveal-pending");
  });
});
