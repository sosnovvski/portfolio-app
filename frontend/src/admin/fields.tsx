"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import type { FieldErrors } from "./api";

export interface FormBinding<Draft> {
  draft: Draft;
  idBase: string;
  errors: FieldErrors;
  set<K extends keyof Draft>(key: K, value: Draft[K]): void;
  /** Clears the errors of a field, and of its items if it is a list. */
  clearErrors(name: string): void;
}

type KeysOfType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T] & string;

function ErrorText({ id, text }: { id: string; text: string | undefined }) {
  return text ? (
    <p className="err" id={id}>
      {text}
    </p>
  ) : null;
}

function describedBy(errorId: string, hasError: boolean, hintId: string | null): string | undefined {
  const ids = [hasError ? errorId : null, hintId].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

interface TextFieldProps<Draft> {
  form: FormBinding<Draft>;
  name: KeysOfType<Draft, string>;
  label: string;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  type?: "text" | "url" | "email" | "number";
  inputMode?: "numeric";
}

export function TextField<Draft>({ form, name, label, hint, required, multiline, type = "text", inputMode }: TextFieldProps<Draft>) {
  const id = `${form.idBase}-${name}`;
  const errorId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : null;
  const error = form.errors[name];
  const shared = {
    id,
    name,
    value: form.draft[name] as string,
    required: Boolean(required),
    onChange: (event: { target: { value: string } }) => {
      form.set(name, event.target.value as Draft[typeof name]);
      form.clearErrors(name);
    },
    ...(error ? { "aria-invalid": true } : {}),
    ...(describedBy(errorId, Boolean(error), hintId)
      ? { "aria-describedby": describedBy(errorId, Boolean(error), hintId) as string }
      : {}),
  };

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? " (required)" : ""}
      </label>
      {hint && (
        <p className="hint" id={hintId as string}>
          {hint}
        </p>
      )}
      {multiline ? (
        <textarea {...shared} rows={6} />
      ) : (
        <input {...shared} type={type} {...(inputMode ? { inputMode } : {})} />
      )}
      <ErrorText id={errorId} text={error} />
    </div>
  );
}

export function CheckboxField<Draft>({
  form,
  name,
  label,
  hint,
}: {
  form: FormBinding<Draft>;
  name: KeysOfType<Draft, boolean>;
  label: string;
  hint?: string;
}) {
  const id = `${form.idBase}-${name}`;
  const errorId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : null;
  const error = form.errors[name];
  const described = describedBy(errorId, Boolean(error), hintId);

  return (
    <div className="field">
      <label className="check" htmlFor={id}>
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={form.draft[name] as boolean}
          onChange={(event) => {
            form.set(name, event.target.checked as Draft[typeof name]);
            form.clearErrors(name);
          }}
          {...(error ? { "aria-invalid": true } : {})}
          {...(described ? { "aria-describedby": described } : {})}
        />
        {label}
      </label>
      {hint && (
        <p className="hint" id={hintId as string}>
          {hint}
        </p>
      )}
      <ErrorText id={errorId} text={error} />
    </div>
  );
}

export function SelectField<Draft>({
  form,
  name,
  label,
  options,
}: {
  form: FormBinding<Draft>;
  name: KeysOfType<Draft, string>;
  label: string;
  options: readonly { value: string; label: string }[];
}) {
  const id = `${form.idBase}-${name}`;
  const errorId = `${id}-error`;
  const error = form.errors[name];

  return (
    <div className="field">
      <label htmlFor={id}>{label} (required)</label>
      <select
        id={id}
        name={name}
        required
        value={form.draft[name] as string}
        onChange={(event) => {
          form.set(name, event.target.value as Draft[typeof name]);
          form.clearErrors(name);
        }}
        {...(error ? { "aria-invalid": true, "aria-describedby": errorId } : {})}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ErrorText id={errorId} text={error} />
    </div>
  );
}

/** English and Polish side by side, one above the other when the screen is narrow. */
export function LangPair({ children }: { children: ReactNode }) {
  return <div className="lang-pair">{children}</div>;
}

const PREVIEW_LENGTH = 40;

let nextItemKey = 1;

/** List rows need a key that follows them when they move. It is never sent to the server. */
export function withKey<T extends object>(item: T): T & { key: number } {
  return { ...item, key: nextItemKey++ };
}

interface ReorderListProps<Item extends { key: number }> {
  legend: string;
  /** Name in the API, for matching errors such as `skills[2]`. */
  name: string;
  itemNoun: string;
  items: readonly Item[];
  /** The row's text, previewed in button names and announcements so each one says which row it acts on. */
  itemText(item: Item): string;
  errors: FieldErrors;
  newItem(): Item;
  onChange(items: Item[]): void;
  clearErrors(name: string): void;
  renderItem(item: Item, index: number, update: (patch: Partial<Item>) => void): ReactNode;
}

/** List order is what gets stored. Moving uses buttons, so it works from a keyboard. */
export function ReorderList<Item extends { key: number }>({
  legend,
  name,
  itemNoun,
  items,
  itemText,
  errors,
  newItem,
  onChange,
  clearErrors,
  renderItem,
}: ReorderListProps<Item>) {
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef<HTMLFieldSetElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const listError = errors[name];

  // Runs after the DOM has moved, because a moved or disabled button can lose focus.
  useEffect(() => {
    if (pendingFocus.current) {
      rootRef.current?.querySelector<HTMLElement>(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });

  function describe(item: Item, index: number): string {
    const text = itemText(item).trim();
    if (!text) {
      return `${itemNoun} ${index + 1}`;
    }
    return `"${text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH).trimEnd()}…` : text}"`;
  }

  function commit(next: Item[]) {
    // Item errors point at positions, which no longer hold after a change.
    clearErrors(name);
    onChange(next);
  }

  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    if (!moved) {
      return;
    }
    next.splice(target, 0, moved);
    const atEdge = target === 0 || target === next.length - 1;
    const direction = atEdge ? (offset === -1 ? "down" : "up") : offset === -1 ? "up" : "down";
    pendingFocus.current = `[data-item="${moved.key}"] [data-move="${next.length > 1 ? direction : ""}"]`;
    setAnnouncement(`Moved ${describe(moved, index)} to position ${target + 1} of ${next.length}.`);
    commit(next);
  }

  function remove(index: number) {
    const next = items.filter((_, position) => position !== index);
    const removed = items[index];
    const neighbour = next[index] ?? next[index - 1];
    pendingFocus.current = neighbour ? `[data-item="${neighbour.key}"] [data-remove]` : "[data-add]";
    setAnnouncement(`Removed ${removed ? describe(removed, index) : itemNoun}. ${next.length} left.`);
    commit(next);
  }

  function add() {
    const item = newItem();
    pendingFocus.current = `[data-item="${item.key}"] input, [data-item="${item.key}"] textarea`;
    commit([...items, item]);
  }

  return (
    <fieldset className="reorder" ref={rootRef}>
      <legend>{legend}</legend>
      {listError && (
        <p className="err list-error" tabIndex={-1}>
          {listError}
        </p>
      )}
      {items.length > 0 && (
        <ol role="list">
          {items.map((item, index) => (
            <li key={item.key} data-item={item.key}>
              <div className="reorder-item">
                {renderItem(item, index, (patch) => {
                  // Typing moves nothing, so only this row's errors are cleared.
                  clearErrors(`${name}[${index}]`);
                  onChange(items.map((current) => (current.key === item.key ? { ...current, ...patch } : current)));
                })}
              </div>
              <div className="reorder-actions">
                <button
                  type="button"
                  data-move="up"
                  disabled={index === 0}
                  aria-label={`Move ${describe(item, index)} up`}
                  onClick={() => move(index, -1)}
                >
                  Up
                </button>
                <button
                  type="button"
                  data-move="down"
                  disabled={index === items.length - 1}
                  aria-label={`Move ${describe(item, index)} down`}
                  onClick={() => move(index, 1)}
                >
                  Down
                </button>
                <button
                  type="button"
                  data-remove=""
                  aria-label={`Remove ${describe(item, index)}`}
                  onClick={() => remove(index)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <button type="button" data-add="" onClick={add}>
        Add {itemNoun}
      </button>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </fieldset>
  );
}

/** One text input inside a reorderable list. */
export function ListInput({
  id,
  label,
  value,
  error,
  multiline,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error: string | undefined;
  multiline?: boolean;
  onChange(value: string): void;
}) {
  const errorId = `${id}-error`;
  const shared = {
    id,
    value,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    ...(error ? { "aria-invalid": true, "aria-describedby": errorId } : {}),
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? <textarea {...shared} rows={2} /> : <input {...shared} />}
      <ErrorText id={errorId} text={error} />
    </div>
  );
}

export interface StringItem {
  key: number;
  text: string;
}

export function toStringItems(values: readonly string[]): StringItem[] {
  return values.map((text) => withKey({ text }));
}

export function fromStringItems(items: readonly StringItem[]): string[] {
  return items.map((item) => item.text.trim());
}

/** A reorderable list of plain strings, for skills and tech. */
export function StringList<Draft>({
  form,
  name,
  legend,
  itemNoun,
}: {
  form: FormBinding<Draft>;
  name: KeysOfType<Draft, StringItem[]>;
  legend: string;
  itemNoun: string;
}) {
  return (
    <ReorderList<StringItem>
      legend={legend}
      name={name}
      itemNoun={itemNoun}
      items={form.draft[name] as StringItem[]}
      itemText={(item) => item.text}
      errors={form.errors}
      clearErrors={form.clearErrors}
      newItem={() => withKey({ text: "" })}
      onChange={(items) => form.set(name, items as Draft[typeof name])}
      renderItem={(item, index, update) => (
        <ListInput
          id={`${form.idBase}-${name}-${item.key}`}
          label={`${itemNoun[0]?.toUpperCase()}${itemNoun.slice(1)} ${index + 1}`}
          value={item.text}
          error={form.errors[`${name}[${index}]`]}
          onChange={(text) => update({ text })}
        />
      )}
    />
  );
}
