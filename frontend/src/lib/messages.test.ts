import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import pl from "../../messages/pl.json";

function keys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "object" && child !== null ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

function strings(value: object): string[] {
  return Object.values(value).flatMap((child) => (typeof child === "object" && child !== null ? strings(child) : [child]));
}

describe("messages", () => {
  it("have the same keys in both languages", () => {
    expect(keys(pl)).toEqual(keys(en));
  });

  it("contain no em dashes", () => {
    expect(strings(en).concat(strings(pl)).filter((text: string) => text.includes("—"))).toEqual([]);
  });
});

describe("Polish counts", () => {
  const t = createTranslator({ locale: "pl", messages: pl, namespace: "timeline" });

  it.each([
    [1, "1 stanowisko"],
    [2, "2 stanowiska"],
    [5, "5 stanowisk"],
    [8, "8 stanowisk"],
    [22, "22 stanowiska"],
  ])("%i roles", (count, expected) => {
    expect(t("roles", { count })).toBe(expected);
  });

  it.each([
    [1, "1 miejscu pracy"],
    [7, "7 miejscach pracy"],
  ])("%i workplaces", (count, expected) => {
    expect(t("workplaces", { count })).toBe(expected);
  });

  it.each([
    [0, "obecnie żadne"],
    [1, "w tym jedno obecne"],
    [2, "w tym 2 obecne"],
    [5, "w tym 5 obecnych"],
  ])("%i current", (count, expected) => {
    expect(t("current", { count })).toBe(expected);
  });
});

describe("Polish waits", () => {
  const t = createTranslator({ locale: "pl", messages: pl, namespace: "contact.failure" });

  it("use the right forms", () => {
    expect(t("minutes", { count: 1 })).toBe("1 minutę");
    expect(t("minutes", { count: 3 })).toBe("3 minuty");
    expect(t("minutes", { count: 5 })).toBe("5 minut");
    expect(t("hours", { count: 22 })).toBe("22 godziny");
  });
});
