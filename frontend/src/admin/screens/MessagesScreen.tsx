"use client";

import { useEffect, useRef, useState } from "react";
import type { MessagePage, MessageView } from "@/api/types";
import { mailtoHref } from "@/lib/links";
import { failureText } from "../api";
import { useAdminSession } from "../session";

const PAGE_SIZE = 20;

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function MessagesScreen() {
  const { api, generation } = useAdminSession();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<MessagePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  // Set by the pager only: its button can become disabled, which would drop keyboard focus.
  const announcePage = useRef(false);

  useEffect(() => {
    let stale = false;
    void api.get<MessagePage>(`/api/admin/messages?page=${page}&size=${PAGE_SIZE}`).then((result) => {
      if (stale) {
        return;
      }
      if (!result.ok) {
        setError(failureText(result.failure));
      } else if (result.data.items.length === 0 && page > 0) {
        // The last message of this page was deleted.
        setPage(page - 1);
      } else {
        setData(result.data);
        setError(null);
        if (announcePage.current) {
          announcePage.current = false;
          const pages = Math.max(1, Math.ceil(result.data.total / result.data.size));
          setStatus(`Page ${result.data.page + 1} of ${pages}`);
          heading.current?.focus();
        }
      }
    });
    return () => {
      stale = true;
    };
  }, [api, page, generation, attempt]);

  async function setRead(message: MessageView, read: boolean) {
    setError(null);
    const result = await api.patch<MessageView>(`/api/admin/messages/${message.id}`, { read });
    if (!result.ok) {
      setError(`The message from ${message.name} was not changed. ${failureText(result.failure)}`);
      return;
    }
    setData((current) =>
      current && {
        ...current,
        items: current.items.map((item) => (item.id === message.id ? result.data : item)),
      },
    );
    setStatus(`Marked the message from ${message.name} as ${read ? "read" : "unread"}.`);
  }

  async function remove(message: MessageView) {
    if (!window.confirm(`Delete the message from ${message.name}? This cannot be undone.`)) {
      return;
    }
    setError(null);
    const result = await api.delete(`/api/admin/messages/${message.id}`);
    if (!result.ok && result.failure.kind !== "notFound") {
      setError(`The message from ${message.name} was not deleted. ${failureText(result.failure)}`);
      return;
    }
    setStatus(`Deleted the message from ${message.name}.`);
    setAttempt((current) => current + 1);
    heading.current?.focus();
  }

  function goToPage(next: number) {
    announcePage.current = true;
    setPage(next);
  }

  const lastPage = data ? Math.max(0, Math.ceil(data.total / data.size) - 1) : 0;

  return (
    <>
      <h2 ref={heading} tabIndex={-1}>
        {data ? `${data.total} ${data.total === 1 ? "message" : "messages"}, newest first` : "Messages"}
      </h2>
      <p className="err" role="alert">
        {error}
      </p>
      <p className="saved" role="status">
        {status}
      </p>
      {!data && !error && <p>Loading</p>}
      {error && !data && (
        <button type="button" onClick={() => setAttempt((current) => current + 1)}>
          Try again
        </button>
      )}
      {data?.items.length === 0 && <p>No messages.</p>}

      {data && data.items.length > 0 && (
        <ul className="items messages" role="list">
          {data.items.map((message) => (
            <li key={message.id}>
              <article>
                <h3>
                  {message.name}, {message.readAt ? "read" : <strong className="unread">unread</strong>}
                </h3>
                <p className="muted">
                  <a href={mailtoHref(message.email)}>{message.email}</a>.{" "}
                  <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>. Language: {message.locale}.
                </p>
                {/* Plain text only: React escapes it, and the CSS keeps its line breaks. */}
                <p className="message-body">{message.message}</p>
                <div className="item-actions">
                  <button
                    type="button"
                    aria-label={`Mark as ${message.readAt ? "unread" : "read"}: message from ${message.name}`}
                    onClick={() => void setRead(message, !message.readAt)}
                  >
                    Mark as {message.readAt ? "unread" : "read"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete: message from ${message.name}`}
                    onClick={() => void remove(message)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {data && data.total > data.size && (
        <nav className="pager" aria-label="Message pages">
          <button type="button" disabled={page === 0} onClick={() => goToPage(page - 1)}>
            Newer
          </button>
          <span>
            Page {page + 1} of {lastPage + 1}
          </span>
          <button type="button" disabled={page >= lastPage} onClick={() => goToPage(page + 1)}>
            Older
          </button>
        </nav>
      )}
    </>
  );
}
