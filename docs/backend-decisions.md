# Backend decisions

Outcome of the schema and API design reviews. Nothing here is verified at runtime until a test covers it.

## Schema
- Months are `date` with a first-of-month check, mapped to `YearMonth` through an `AttributeConverter<YearMonth, LocalDate>`.
- Enums are `varchar` with a named check, `@Enumerated(STRING)`.
- Timestamps are `timestamptz`, mapped to `Instant`.
- `sort_order` is not unique, only `>= 0`. Order by `sort_order, id`. A plain unique constraint breaks whole-child replacement because Hibernate inserts before it deletes. The name avoids the HQL and SQL `position` function.
- URLs must start with `https://`, enforced in the database and in validation, so `javascript:` links cannot reach the public page.
- `contact_message` has no `version` or `updated_at`, and a length-limited body.
- No placeholder profile row in the migration. It would conflict with the seed, which runs only on an empty database, and could expose invented data. The public API returns 404 until a profile exists.

## API
- `{locale:en|pl}` in the path, so an unsupported locale is a plain 404.
- `spring.mvc.problemdetails.enabled=true`, `open-in-view=false`, `default_batch_fetch_size=50`.
- `PUT` requires `version`. Load, compare explicitly, return 409 on mismatch, force a version bump so child-only edits count, and flush before mapping the response.
- Contact order: per-IP limit, honeypot (202, nothing stored), validation, global limit, store. Log a warning when the global quota is exhausted. Caddy caps the body at 32KB.

## Security (milestone 4)
- `server.forward-headers-strategy=native`, with `server.tomcat.remoteip.internal-proxies` pinned to Caddy's fixed IP. The backend port is never published. Limiters use only `request.getRemoteAddr()`.
- Deployment smoke test: log `remoteAddr` for external IPv4 and IPv6 requests.
- Login limiter is a filter before `UsernamePasswordAuthenticationFilter`, created with `new` to avoid double registration. It reserves an attempt atomically and refunds on success.
- Login limits: 5 failures per client per 15 minutes, plus at most 2 concurrent bcrypt checks. There is no global failure count, because a small pool of addresses could use it to lock the owner out. The admin password must be random, 20 or more characters.
- Limiter counters use Caffeine with `expireAfterWrite` and a maximum size. IPv6 keys use the /64 prefix.
- `http.requestCache(c -> c.disable())`, so anonymous requests cannot create sessions.
- Login is form-encoded. Custom entry point, access-denied and failure handlers return problem JSON, and logout returns 204. Test the exact JSON shape of the 401, 403 and 429 responses.
- `dispatcherTypeMatchers(ERROR).permitAll()`, `EndpointRequest.to("health")` permitted, chain ends with `anyRequest().denyAll()`.
- Actuator exposes `health` only.
- Keep the contact POST browser to Caddy, not through a Next server action, so per-IP limits see the real client. Admin requests stay in the browser.
- Single-quote or escape the bcrypt hash in Compose, because `$` is interpolated.

## Security review outcome
- Public routes use a separate filter chain with no session, CSRF token or cookies. `csrf.spa()` would otherwise set `XSRF-TOKEN` on every response.
- `FormContentFilter` is disabled, because it reads form-encoded PUT, PATCH and DELETE bodies with no size limit, before security. Caddy must also cap `/api/*` at 1MB and the contact route at 32KB.
- `TRUSTED_PROXY` fails silently if wrong. In Compose use `${TRUSTED_PROXY:?}` or omit it, and pin the address of Caddy. `LoginRateLimitFilter` logs an error when `X-Forwarded-For` survives Tomcat.
- `AdminProperties` is checked outside Bean Validation, because Boot prints rejected values at startup.
- Logs contain no client addresses.
- HSTS is set once, in Caddy (`max-age=31536000`), not in Spring.
- The admin UI must not poll `/api/auth/session`, or an open tab never reaches the idle timeout.
- Frontend: escape `<` in JSON-LD, encode `mailto:` values, use `rel="noopener noreferrer"` on external links.

## Check when deploying
- IPv6: the `edge` network is IPv4 only, so Docker may forward IPv6 visitors through its gateway address, and they would all share one rate limit key. Publish no AAAA record, or confirm with the smoke test above that real addresses arrive.
- Name the hosting provider, or its category, as a recipient in the privacy notice (Art. 13(1)(e)).

## Deferred, revisit when choosing hosting
- `__Host-` cookie names. A hostile sibling subdomain could set a known CSRF cookie and force a logout. Matters only if the subdomains of the domain are not all controlled by the owner.
- Absolute session lifetime. The idle timeout is 30 minutes and a stolen cookie would need host compromise.
