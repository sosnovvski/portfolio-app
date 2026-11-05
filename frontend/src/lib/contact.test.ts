import { afterEach, describe, expect, it, vi } from "vitest";
import { mailtoHref, safeHttpsUrl } from "./links";
import { parseRetryAfter, submitContact, validateContact, waitInUnits } from "./contact";

const VALID = { name: "Ada", email: "ada@example.com", message: "Hello, a long enough message." };

describe("validateContact, same limits as the server", () => {
  it("accepts a valid message", () => {
    expect(validateContact(VALID)).toEqual({});
  });

  it("requires every field", () => {
    expect(validateContact({ name: " ", email: "", message: "  " })).toEqual({
      name: "nameRequired",
      email: "emailRequired",
      message: "messageRequired",
    });
  });

  it("applies the boundaries", () => {
    expect(validateContact({ ...VALID, name: "a".repeat(100) }).name).toBeUndefined();
    expect(validateContact({ ...VALID, name: "a".repeat(101) }).name).toBe("nameTooLong");
    const domain = "@example.com";
    expect(validateContact({ ...VALID, email: "a".repeat(254 - domain.length) + domain }).email).toBeUndefined();
    expect(validateContact({ ...VALID, email: "a".repeat(255 - domain.length) + domain }).email).toBe("emailTooLong");
    expect(validateContact({ ...VALID, message: "a".repeat(9) }).message).toBe("messageTooShort");
    expect(validateContact({ ...VALID, message: "a".repeat(10) }).message).toBeUndefined();
    expect(validateContact({ ...VALID, message: "a".repeat(5000) }).message).toBeUndefined();
    expect(validateContact({ ...VALID, message: "a".repeat(5001) }).message).toBe("messageTooLong");
  });

  it("uses the server's email pattern", () => {
    expect(validateContact({ ...VALID, email: "no-at-sign" }).email).toBe("emailInvalid");
    expect(validateContact({ ...VALID, email: "a b@example.com" }).email).toBe("emailInvalid");
  });
});

describe("Retry-After", () => {
  it("reads seconds and dates", () => {
    expect(parseRetryAfter("120", 0)).toBe(120);
    expect(parseRetryAfter("Thu, 01 Jan 1970 00:01:00 GMT", 0)).toBe(60);
    expect(parseRetryAfter(null, 0)).toBeNull();
    expect(parseRetryAfter("soon", 0)).toBeNull();
  });

  it("picks a readable unit and rounds up", () => {
    expect(waitInUnits(30)).toEqual({ unit: "seconds", count: 30 });
    expect(waitInUnits(61)).toEqual({ unit: "minutes", count: 2 });
    expect(waitInUnits(7200)).toEqual({ unit: "hours", count: 2 });
  });
});

describe("submitContact", () => {
  const body = { ...VALID, locale: "en", contactRef: "" };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts JSON to the relative endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitContact(body)).resolves.toEqual({ kind: "accepted" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/contact");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it("maps only known fields from a 400", async () => {
    const problem = { errors: [{ field: "email", message: "bad" }, { field: "locale", message: "bad" }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(problem, { status: 400 })));
    await expect(submitContact(body)).resolves.toEqual({ kind: "invalid", fields: ["email"] });
  });

  it("treats a 400 with no usable field as a server problem", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 400 })));
    await expect(submitContact(body)).resolves.toEqual({ kind: "serverError" });
  });

  it("reads the wait from a 429", async () => {
    const response = new Response(null, { status: 429, headers: { "Retry-After": "90" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(submitContact(body)).resolves.toEqual({ kind: "rateLimited", retryAfterSeconds: 90 });
  });

  it("separates network failure from a server failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));
    await expect(submitContact(body)).resolves.toEqual({ kind: "networkError" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(submitContact(body)).resolves.toEqual({ kind: "serverError" });
  });
});

describe("links", () => {
  it("keeps the mailto separator and encodes the rest", () => {
    expect(mailtoHref("a+b&c@example.com")).toBe("mailto:a%2Bb%26c@example.com");
    expect(mailtoHref("x@example.com?bcc=y@evil.test")).toBe("mailto:x%40example.com%3Fbcc%3Dy@evil.test");
  });

  it("allows only https", () => {
    expect(safeHttpsUrl("https://example.com")).toBe("https://example.com");
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpsUrl("http://example.com")).toBeNull();
    expect(safeHttpsUrl(null)).toBeNull();
    expect(safeHttpsUrl(undefined)).toBeNull();
  });
});
