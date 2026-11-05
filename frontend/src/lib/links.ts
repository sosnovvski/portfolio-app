/** The backend only accepts https:// links. This stays as a second check, so a bad value is dropped rather than linked. */
export function safeHttpsUrl(value: string | null | undefined): string | null {
  return value && /^https:\/\//i.test(value) ? value : null;
}

/** Encodes each side separately: the separating @ must stay literal for mail clients. */
export function mailtoHref(email: string): string {
  const separator = email.lastIndexOf("@");
  if (separator < 0) {
    return `mailto:${encodeURIComponent(email)}`;
  }
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  return `mailto:${encodeURIComponent(local)}@${encodeURIComponent(domain)}`;
}

export function roleAnchor(id: number): string {
  return `role-${id}`;
}
