FROM caddy:2-alpine
COPY unavailable.html /srv/errors/unavailable.html
# Named volumes inherit this ownership when first created.
RUN chown -R 1000:1000 /data /config
USER 1000:1000
