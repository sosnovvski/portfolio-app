import { vi } from "vitest";

export interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

type Handler = (call: Call) => Response | Promise<Response> | Error;

/** A scripted fetch: the first route whose "METHOD path" prefix matches answers. Every call is recorded. */
export function stubServer(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      method: init.method ?? "GET",
      url,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: (init.body as string | undefined) ?? null,
    };
    calls.push(call);
    const route = Object.keys(routes).find((key) => `${call.method} ${url}`.startsWith(key));
    if (!route) {
      throw new Error(`No route for ${call.method} ${url}`);
    }
    const answer = await routes[route]!(call);
    if (answer instanceof Error) {
      throw answer;
    }
    return answer;
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, routes };
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function problem(status: number, extra: object = {}, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ status, title: "Problem", ...extra }), {
    status,
    headers: { "Content-Type": "application/problem+json", ...headers },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function setCookie(value: string) {
  document.cookie = `XSRF-TOKEN=${value}; path=/`;
}
