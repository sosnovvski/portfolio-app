# Caddy 2.11.9 carries the go-jose fix for CVE-2026-116587, but has no official image yet.
# When caddy:2-alpine reaches 2.11.9 or later, drop this stage and the COPY of the binary below.
FROM caddy:2-builder-alpine AS build
# The builder adds a file capability, which cannot start under cap_drop and no-new-privileges.
# Compose lets the non-root user bind low ports with a sysctl instead.
RUN xcaddy build v2.11.9 --output /caddy && setcap -r /caddy

FROM caddy:2-alpine
RUN apk upgrade --no-cache
COPY --from=build /caddy /usr/bin/caddy
COPY unavailable.html /srv/errors/unavailable.html
# Named volumes inherit this ownership when first created.
RUN chown -R 1000:1000 /data /config
USER 1000:1000
