"use client";

import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { type ApiFailure, type ApiResult, failureText, type FieldErrors } from "./api";
import type { FormBinding } from "./fields";
import { useAdminSession } from "./session";

export interface FormConfig<Form, Draft> {
  /** Field names as the API reports them. An error for any other name is shown above the form. */
  fields: readonly string[];
  fromForm(form: Form | null): Draft;
  toPayload(draft: Draft): Form;
  /** Only what JSON could not carry, such as a number field holding text. The server checks the rest. */
  validate?(draft: Draft): FieldErrors;
  renderFields(form: FormBinding<Draft>): ReactNode;
}

interface Identified {
  id?: number;
  version?: number;
}

type Notice =
  | { kind: "saved"; text: string }
  | { kind: "conflict"; text: string }
  | { kind: "deleted" }
  | { kind: "failed"; text: string };

interface EntityFormProps<Form extends Identified, Draft> {
  config: FormConfig<Form, Draft>;
  initial: Form | null;
  submitLabel: string;
  save(payload: Form, id: number | undefined): Promise<ApiResult<Form>>;
  /** Fetches the current server copy. `data: null` means it no longer exists. */
  reload(id: number | undefined): Promise<ApiResult<Form | null>>;
  onSaved(form: Form): void;
  onDirtyChange?(dirty: boolean): void;
  /** Extra buttons for the sticky row, beside Save and the saved status. */
  actions?: ReactNode;
  children?: ReactNode;
}

function isKnownField(name: string, fields: readonly string[]): boolean {
  return fields.includes(name.replace(/\[.*$/, ""));
}

const SAVED_PUBLIC = "Saved. The public site shows this now.";
const SAVED_UNPUBLISHED = "Saved, not published. It stays off the public site until you tick Published.";

export function savedMessage(form: object): string {
  return "published" in form && form.published === false ? SAVED_UNPUBLISHED : SAVED_PUBLIC;
}

export function failureNotice(failure: ApiFailure): Notice {
  if (failure.kind === "conflict") {
    return { kind: "conflict", text: failure.detail ?? "Someone changed this item since you opened it." };
  }
  if (failure.kind === "notFound") {
    return { kind: "deleted" };
  }
  if (failure.kind === "unauthorized") {
    // Still on screen after the new login, so it must read correctly then too.
    return { kind: "failed", text: "This was not saved because your session ended. Your text is kept. Save again." };
  }
  return { kind: "failed", text: failureText(failure) };
}

export function EntityForm<Form extends Identified, Draft>({
  config,
  initial,
  submitLabel,
  save,
  reload,
  onSaved,
  onDirtyChange,
  actions,
  children,
}: EntityFormProps<Form, Draft>) {
  const idBase = useId();
  const { setFormDirty } = useAdminSession();
  const [draft, setDraft] = useState<Draft>(() => config.fromForm(initial));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [identity, setIdentity] = useState<Identified>({
    ...(initial?.id === undefined ? {} : { id: initial.id }),
    ...(initial?.version === undefined ? {} : { version: initial.version }),
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Set by a save only, so clearing an error while typing never moves focus.
  const pendingFocus = useRef<"invalid" | "button" | null>(null);

  const dirty = JSON.stringify(draft) !== baseline;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    setFormDirty(idBase, dirty);
    return () => setFormDirty(idBase, false);
  }, [dirty, idBase, setFormDirty]);

  useEffect(() => {
    if (pendingFocus.current === "invalid") {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], .list-error')?.focus();
    } else if (pendingFocus.current === "button") {
      buttonRef.current?.focus();
    }
    pendingFocus.current = null;
  }, [errors, notice]);

  function adopt(form: Form) {
    const next = config.fromForm(form);
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setIdentity({
      ...(form.id === undefined ? {} : { id: form.id }),
      ...(form.version === undefined ? {} : { version: form.version }),
    });
    setErrors({});
  }

  function clearErrors(name: string) {
    setErrors((current) => {
      const remaining = Object.entries(current).filter(
        ([field]) => field !== name && !field.startsWith(`${name}[`) && !field.startsWith(`${name}.`),
      );
      return remaining.length === Object.keys(current).length ? current : Object.fromEntries(remaining);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }

    const invalid = config.validate?.(draft) ?? {};
    if (Object.keys(invalid).length > 0) {
      pendingFocus.current = "invalid";
      setErrors(invalid);
      setNotice(null);
      return;
    }

    setSaving(true);
    setNotice(null);
    const payload: Form = {
      ...config.toPayload(draft),
      ...(identity.id === undefined ? {} : { id: identity.id }),
      ...(identity.version === undefined ? {} : { version: identity.version }),
    };
    const result = await save(payload, identity.id);
    setSaving(false);

    if (result.ok) {
      adopt(result.data);
      pendingFocus.current = "button";
      setNotice({ kind: "saved", text: savedMessage(result.data) });
      onSaved(result.data);
      return;
    }

    if (result.failure.kind === "invalid") {
      const { fields, detail } = result.failure;
      const unknown = Object.entries(fields).filter(([field]) => !isKnownField(field, config.fields));
      pendingFocus.current = unknown.length === Object.keys(fields).length ? "button" : "invalid";
      setErrors(fields);
      setNotice(
        unknown.length > 0 || Object.keys(fields).length === 0
          ? {
              kind: "failed",
              text:
                unknown.map(([field, message]) => `${field}: ${message}`).join(". ") ||
                detail ||
                "The server did not accept this. Check the values and try again.",
            }
          : null,
      );
      return;
    }

    // After a 401 the login form has focus, and AdminApp restores it after login.
    pendingFocus.current = result.failure.kind === "unauthorized" ? null : "button";
    setNotice(failureNotice(result.failure));
  }

  async function loadLatest() {
    const result = await reload(identity.id);
    // Whatever happens next, the button that was just pressed goes away.
    pendingFocus.current = "button";
    if (!result.ok) {
      setNotice(failureNotice(result.failure));
    } else if (result.data === null) {
      setNotice({ kind: "deleted" });
    } else {
      adopt(result.data);
      setNotice({ kind: "saved", text: "Loaded the latest version." });
    }
  }

  function saveAsNew() {
    pendingFocus.current = "button";
    setIdentity({});
    setNotice({ kind: "saved", text: "This will be saved as a new item. Your text is kept." });
  }

  const binding: FormBinding<Draft> = {
    draft,
    idBase,
    errors,
    set: (key, value) => {
      setDraft((current) => ({ ...current, [key]: value }));
      setNotice((current) => (current?.kind === "saved" ? null : current));
    },
    clearErrors,
  };

  return (
    <form ref={formRef} className="stack" noValidate onSubmit={handleSubmit}>
      {children}
      {config.renderFields(binding)}

      {/* Failures sit in the sticky row too: below it they could be off screen when Save is pressed mid-form. */}
      <div className="form-actions">
        <div className="form-alert" role="alert">
          {notice?.kind === "failed" && <p className="err">{notice.text}</p>}
          {notice?.kind === "conflict" && (
            <div className="notice">
              <p>{notice.text} Your text is kept in the form.</p>
              <p>Copy your text first if you want to keep it.</p>
              <button type="button" onClick={() => void loadLatest()}>
                Discard my text and load the latest version
              </button>
            </div>
          )}
          {notice?.kind === "deleted" && (
            <div className="notice">
              <p>This item was deleted while you were editing it. Your text is kept in the form.</p>
              <button type="button" onClick={saveAsNew}>
                Save it as a new item instead
              </button>
            </div>
          )}
        </div>
        <button ref={buttonRef} type="submit" className="primary" disabled={saving}>
          {saving ? "Saving" : submitLabel}
        </button>
        <p className="saved" role="status">
          {notice?.kind === "saved" ? notice.text : null}
        </p>
        {actions}
      </div>
    </form>
  );
}
