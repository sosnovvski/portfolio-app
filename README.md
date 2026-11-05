# Portfolio

Personal site of Kamil Sosnowski: career, skills and projects in English and Polish, with an admin panel for editing content without a deployment.

| Part | Stack |
|---|---|
| `frontend/` | Next.js, TypeScript, next-intl |
| `backend/` | Spring Boot, PostgreSQL, Flyway |
| `caddy/`, `Caddyfile` | The only public entry point: routing, HTTPS, body limits, security headers |
| `e2e/` | Playwright and axe, run against the full stack |
| `contracts/openapi.json` | The API contract. A test fails when the API drifts from it |
| `seed/content.json` | Initial content, imported once into an empty database |
| `docs/` | Design system and backend decisions |

## Run it

You need Docker.

1. Copy `.env.example` to `.env` and fill it in. The file explains how to make the password hash.
2. Run `docker compose up -d --build --wait`.
3. Open <http://localhost> for the site and <http://localhost/admin> for the panel.

To deploy, set `SITE_ADDRESS` to the domain, `SITE_URL` to `https://` plus the domain, and `COOKIE_SECURE=true`. Caddy then gets its HTTPS certificate automatically. Check that the server's proxy setup still lets the backend see real client addresses: see `docs/backend-decisions.md`.

Back up with `sh scripts/backup.sh` and copy the files off the server, because all content lives in the database.

## Test it

```sh
# Backend, including PostgreSQL integration tests. Needs Docker.
cd backend && ./mvnw verify

# Frontend
cd frontend && npm ci && npm run lint && npm run typecheck && npm test

# Full stack in a browser. E2E_BROWSER_CHANNEL=msedge uses an installed Edge instead of downloading a browser.
docker compose --env-file e2e/e2e.env -f compose.yaml -f compose.e2e.yaml -p portfolio-e2e up -d --build --wait
cd e2e && npm ci && npx playwright test
cd .. && sh scripts/check-failure-modes.sh
docker compose --env-file e2e/e2e.env -f compose.yaml -f compose.e2e.yaml -p portfolio-e2e down -v
```

After an intended API change, regenerate the contract and the frontend types:

```sh
cd backend && ./mvnw verify -Dit.test=OpenApiContractIT -Dtest=YearMonthConverterTest -Dcontract.update=true
cd ../frontend && npm run gen:api
```
