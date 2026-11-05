"use client";

import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CONTACT_FIELDS,
  type ContactField,
  type ContactValues,
  type FieldErrorCode,
  submitContact,
  validateContact,
  waitInUnits,
} from "@/lib/contact";

type ShownError = FieldErrorCode | "nameRejected" | "emailRejected" | "messageRejected";
type ShownErrors = Partial<Record<ContactField, ShownError>>;

type Outcome =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "failed"; text: string };

const EMPTY: ContactValues = { name: "", email: "", message: "" };

const noSubscription = () => () => {};

/** False in server-rendered HTML, so the button cannot submit until the handler is attached. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

export function ContactForm() {
  const t = useTranslations("contact");
  const locale = useLocale();
  const hydrated = useHydrated();
  const [values, setValues] = useState(EMPTY);
  const [contactRef, setContactRef] = useState("");
  const [errors, setErrors] = useState<ShownErrors>({});
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Set by a submit only. Clearing one field's error while typing must not move focus to the next invalid field.
  const focusFirstInvalid = useRef(false);

  // The button is disabled while sending, which can drop keyboard focus, so it gets focus back.
  useEffect(() => {
    if (outcome.kind === "sent" || outcome.kind === "failed") {
      buttonRef.current?.focus();
    }
  }, [outcome]);

  useEffect(() => {
    if (!focusFirstInvalid.current) {
      return;
    }
    focusFirstInvalid.current = false;
    const refs = { name: nameRef, email: emailRef, message: messageRef };
    const first = CONTACT_FIELDS.find((field) => errors[field]);
    if (first) {
      refs[first].current?.focus();
    }
  }, [errors]);

  function update(field: ContactField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
    setOutcome((current) => (current.kind === "sent" ? { kind: "idle" } : current));
  }

  function rateLimitText(seconds: number | null): string {
    if (seconds === null) {
      return t("failure.rateLimited");
    }
    const { unit, count } = waitInUnits(seconds);
    return t("failure.rateLimitedWait", { wait: t(`failure.${unit}`, { count }) });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (outcome.kind === "sending") {
      return;
    }

    const invalid = validateContact(values);
    if (Object.keys(invalid).length > 0) {
      focusFirstInvalid.current = true;
      setErrors(invalid);
      setOutcome({ kind: "idle" });
      return;
    }

    setErrors({});
    setOutcome({ kind: "sending" });
    const result = await submitContact({
      name: values.name.trim(),
      email: values.email.trim(),
      message: values.message.trim(),
      locale,
      contactRef,
    });

    switch (result.kind) {
      case "accepted":
        setValues(EMPTY);
        setOutcome({ kind: "sent" });
        break;
      case "invalid":
        focusFirstInvalid.current = true;
        setErrors(Object.fromEntries(result.fields.map((field) => [field, `${field}Rejected` as const])));
        setOutcome({ kind: "idle" });
        break;
      case "rateLimited":
        setOutcome({ kind: "failed", text: rateLimitText(result.retryAfterSeconds) });
        break;
      case "networkError":
        setOutcome({ kind: "failed", text: t("failure.network") });
        break;
      case "serverError":
        setOutcome({ kind: "failed", text: t("failure.server") });
        break;
    }
  }

  function fieldProps(field: ContactField) {
    const hasError = Boolean(errors[field]);
    return {
      id: `contact-${field}`,
      name: field,
      value: values[field],
      required: true,
      ...(hasError ? { "aria-invalid": true, "aria-describedby": `contact-${field}-error` } : {}),
    };
  }

  function errorText(field: ContactField) {
    const code = errors[field];
    if (!code) {
      return null;
    }
    return (
      <p className="err" id={`contact-${field}-error`}>
        {code === "messageTooLong"
          ? t("errors.messageTooLong", { count: values.message.trim().length })
          : t(`errors.${code}`)}
      </p>
    );
  }

  const sending = outcome.kind === "sending";

  return (
    // method="post" keeps typed text out of the address bar if the form is ever submitted before hydration.
    <form method="post" noValidate onSubmit={handleSubmit}>
      <noscript>
        <p className="err">{t("noscript")}</p>
      </noscript>
      <p className="muted form-note">{t("allRequired")}</p>

      <div className="field">
        <label htmlFor="contact-name">{t("name")}</label>
        <input
          {...fieldProps("name")}
          ref={nameRef}
          autoComplete="name"
          onChange={(event) => update("name", event.target.value)}
        />
        {errorText("name")}
      </div>

      <div className="field">
        <label htmlFor="contact-email">{t("emailLabel")}</label>
        <input
          {...fieldProps("email")}
          ref={emailRef}
          type="email"
          autoComplete="email"
          onChange={(event) => update("email", event.target.value)}
        />
        {errorText("email")}
      </div>

      <div className="field">
        <label htmlFor="contact-message">{t("message")}</label>
        <textarea
          {...fieldProps("message")}
          ref={messageRef}
          rows={5}
          onChange={(event) => update("message", event.target.value)}
        />
        {errorText("message")}
      </div>

      <div className="hp" aria-hidden="true">
        <label htmlFor="contact-ref">{t("honeypot")}</label>
        {/* A neutral name and password manager opt-outs: autofill here would make a real message vanish. */}
        <input
          id="contact-ref"
          name="contact_ref"
          data-1p-ignore=""
          data-lpignore="true"
          data-bwignore=""
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={contactRef}
          onChange={(event) => setContactRef(event.target.value)}
        />
      </div>

      <p className="muted form-note">
        {t.rich("retention", {
          link: (chunks) => <a href={`/${locale}/privacy`}>{chunks}</a>,
        })}
      </p>

      <button ref={buttonRef} type="submit" disabled={sending || !hydrated}>
        {sending ? t("sending") : t("send")}
      </button>

      {/* Both regions stay in the DOM and rendered from the start, so assistive tech announces new text. */}
      <div className="form-live">
        <p className="sent" role="status">
          {outcome.kind === "sent" ? t("sent") : null}
        </p>
        <p className="err" role="alert">
          {outcome.kind === "failed" ? outcome.text : null}
        </p>
      </div>
    </form>
  );
}
