import type { ApiProblem, ContactForm } from "@/api/types";

export const CONTACT_ENDPOINT = "/api/public/contact";
export const LIMITS = { name: 100, email: 254, messageMin: 10, messageMax: 5000 } as const;

const TIMEOUT_MS = 15000;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+$/;

export type ContactField = "name" | "email" | "message";
export const CONTACT_FIELDS: readonly ContactField[] = ["name", "email", "message"];

export type FieldErrorCode =
  | "nameRequired"
  | "nameTooLong"
  | "emailRequired"
  | "emailInvalid"
  | "emailTooLong"
  | "messageRequired"
  | "messageTooShort"
  | "messageTooLong";

export type FieldErrors = Partial<Record<ContactField, FieldErrorCode>>;
export type ContactValues = Record<ContactField, string>;

/** Same limits as the server, applied to the trimmed values that are actually sent. */
export function validateContact(values: ContactValues): FieldErrors {
  const name = values.name.trim();
  const email = values.email.trim();
  const message = values.message.trim();
  const errors: FieldErrors = {};

  if (!name) errors.name = "nameRequired";
  else if (name.length > LIMITS.name) errors.name = "nameTooLong";

  if (!email) errors.email = "emailRequired";
  else if (email.length > LIMITS.email) errors.email = "emailTooLong";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "emailInvalid";

  if (!message) errors.message = "messageRequired";
  else if (message.length < LIMITS.messageMin) errors.message = "messageTooShort";
  else if (message.length > LIMITS.messageMax) errors.message = "messageTooLong";

  return errors;
}

export type SubmitResult =
  | { kind: "accepted" }
  | { kind: "invalid"; fields: ContactField[] }
  | { kind: "rateLimited"; retryAfterSeconds: number | null }
  | { kind: "serverError" }
  | { kind: "networkError" };

/** Accepts both forms of the header: seconds, which the backend sends, and an HTTP date. */
export function parseRetryAfter(header: string | null, nowMs: number): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - nowMs) / 1000));
}

export function waitInUnits(seconds: number): { unit: "seconds" | "minutes" | "hours"; count: number } {
  if (seconds < 60) return { unit: "seconds", count: Math.max(1, seconds) };
  if (seconds < 7200) return { unit: "minutes", count: Math.ceil(seconds / 60) };
  return { unit: "hours", count: Math.ceil(seconds / 3600) };
}

function isContactField(value: string): value is ContactField {
  return (CONTACT_FIELDS as readonly string[]).includes(value);
}

/** Only the field names are used: the server's texts are not translated. */
function invalidFields(problem: Partial<ApiProblem>): ContactField[] {
  const fields = (problem.errors ?? []).map((error) => error.field).filter(isContactField);
  return [...new Set(fields)];
}

/** Same-origin on purpose: the backend limits must see the real client address. */
export async function submitContact(body: ContactForm): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetch(CONTACT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { kind: "networkError" };
  }

  if (response.ok) {
    return { kind: "accepted" };
  }
  if (response.status === 429) {
    return { kind: "rateLimited", retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After"), Date.now()) };
  }
  if (response.status === 400) {
    const problem = (await response.json().catch(() => ({}))) as Partial<ApiProblem>;
    const fields = invalidFields(problem);
    return fields.length > 0 ? { kind: "invalid", fields } : { kind: "serverError" };
  }
  return { kind: "serverError" };
}
