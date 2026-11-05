"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { type ApiResult, failureText } from "./api";
import { EntityForm, type FormConfig } from "./EntityForm";
import { useAdminSession } from "./session";

interface Entity {
  id?: number;
  version?: number;
}

interface CrudScreenProps<Form extends Entity, Draft> {
  /** For example `/api/admin/experiences`. */
  path: string;
  noun: string;
  config: FormConfig<Form, Draft>;
  /** Pre-fills what a new item needs, such as the next sort order. */
  newItem?(items: readonly Form[]): Form | null;
  itemLabel(item: Form): string;
  itemDetail?(item: Form): ReactNode;
  /** The order the server lists them in, kept after a local change. */
  compare(a: Form, b: Form): number;
  intro?: ReactNode;
}

type Editor<Form> = { key: number; initial: Form | null };

export function CrudScreen<Form extends Entity, Draft>({
  path,
  noun,
  config,
  newItem,
  itemLabel,
  itemDetail,
  compare,
  intro,
}: CrudScreenProps<Form, Draft>) {
  const { api, generation } = useAdminSession();
  const [items, setItems] = useState<Form[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<Editor<Form> | null>(null);
  const [status, setStatus] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const dirty = useRef(false);
  const nextEditorKey = useRef(1);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const focusEditor = useRef(false);

  useEffect(() => {
    let stale = false;
    void api.get<Form[]>(path).then((result) => {
      if (stale) {
        return;
      }
      if (result.ok) {
        setItems(result.data);
        setLoadError(null);
      } else {
        setLoadError(failureText(result.failure));
      }
    });
    return () => {
      stale = true;
    };
  }, [api, path, generation, attempt]);

  useEffect(() => {
    if (focusEditor.current && editor) {
      focusEditor.current = false;
      editorHeading.current?.focus();
    }
  }, [editor]);

  function canLeaveEditor(): boolean {
    return !dirty.current || window.confirm("You have unsaved changes. Discard them?");
  }

  function open(initial: Form | null) {
    if (!canLeaveEditor()) {
      return;
    }
    dirty.current = false;
    focusEditor.current = true;
    setStatus("");
    setEditor({ key: nextEditorKey.current++, initial });
  }

  function close() {
    if (!canLeaveEditor()) {
      return;
    }
    dirty.current = false;
    setEditor(null);
    listHeading.current?.focus();
  }

  function upsert(saved: Form) {
    setItems((current) =>
      [...(current ?? []).filter((item) => item.id !== saved.id), saved].sort(compare),
    );
    // Only the heading reads this: EntityForm uses `initial` on mount alone, so the draft is untouched.
    setEditor((current) => current && { ...current, initial: saved });
  }

  async function remove(item: Form) {
    const label = itemLabel(item);
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) {
      return;
    }
    setDeleteError(null);
    const result = await api.delete(`${path}/${item.id}`);
    if (!result.ok && result.failure.kind !== "notFound") {
      setDeleteError(`"${label}" was not deleted. ${failureText(result.failure)}`);
      return;
    }
    setItems((current) => (current ?? []).filter((other) => other.id !== item.id));
    if (editor?.initial?.id === item.id) {
      dirty.current = false;
      setEditor(null);
    }
    setStatus(result.ok ? `Deleted "${label}".` : `"${label}" was already deleted.`);
    listHeading.current?.focus();
  }

  async function reload(id: number | undefined): Promise<ApiResult<Form | null>> {
    const result = await api.get<Form[]>(path);
    if (!result.ok) {
      return result;
    }
    setItems(result.data);
    const latest = result.data.find((item) => item.id === id) ?? null;
    if (latest) {
      setEditor((current) => current && { ...current, initial: latest });
    }
    return { ok: true, status: result.status, data: latest };
  }

  function save(payload: Form, id: number | undefined): Promise<ApiResult<Form>> {
    return id === undefined ? api.post<Form>(path, payload) : api.put<Form>(`${path}/${id}`, payload);
  }

  return (
    <>
      {intro}
      {loadError && (
        <div role="alert" className="notice">
          <p>{loadError}</p>
          <button type="button" onClick={() => setAttempt((current) => current + 1)}>
            Try again
          </button>
        </div>
      )}

      <h2 ref={listHeading} tabIndex={-1}>
        All items
      </h2>
      {items === null && !loadError && <p>Loading</p>}
      {items?.length === 0 && <p>Nothing here yet.</p>}
      {items && items.length > 0 && (
        <ul className="items" role="list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{itemLabel(item)}</strong>
                {itemDetail && <div className="muted">{itemDetail(item)}</div>}
              </div>
              <div className="item-actions">
                <button type="button" aria-label={`Edit ${itemLabel(item)}`} onClick={() => open(item)}>
                  Edit
                </button>
                <button type="button" aria-label={`Delete ${itemLabel(item)}`} onClick={() => void remove(item)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="saved" role="status">
        {status}
      </p>
      <p className="err" role="alert">
        {deleteError}
      </p>
      {items && (
        <button type="button" onClick={() => open(newItem?.(items) ?? null)}>
          New {noun}
        </button>
      )}

      {editor && (
        <section className="editor" aria-labelledby={`editor-heading-${path}`}>
          <h2 id={`editor-heading-${path}`} ref={editorHeading} tabIndex={-1}>
            {editor.initial?.id === undefined ? `New ${noun}` : `Edit ${itemLabel(editor.initial)}`}
          </h2>
          <EntityForm<Form, Draft>
            key={editor.key}
            config={config}
            initial={editor.initial}
            submitLabel={`Save ${noun}`}
            save={save}
            reload={reload}
            onSaved={upsert}
            onDirtyChange={(value) => {
              dirty.current = value;
            }}
            actions={
              <button type="button" className="form-close" onClick={close}>
                Close editor
              </button>
            }
          />
        </section>
      )}
    </>
  );
}

/** Whole-number text from a number input, or an error message for the validators. */
export function wholeNumberError(value: string, options: { required: boolean }): string | null {
  const text = value.trim();
  if (!text) {
    return options.required ? "Enter a whole number, 0 or more." : null;
  }
  return /^\d+$/.test(text) ? null : "Enter a whole number, 0 or more.";
}

/** An omitted optional clears the stored value, because a save replaces the whole item. */
export function optional<K extends string>(key: K, value: string): { [P in K]?: string } {
  const text = value.trim();
  return (text ? { [key]: text } : {}) as { [P in K]?: string };
}

export function nextSortOrder(items: readonly { sortOrder: number }[]): number {
  return items.reduce((highest, item) => Math.max(highest, item.sortOrder + 1), 0);
}
