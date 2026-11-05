FROM node:24-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine
# The standalone server runs on Node alone. Without npm and corepack the image carries less to attack
# and to patch, since every known vulnerability found in it was in npm's own dependencies.
RUN apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-*
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /build/.next/standalone ./
COPY --from=build /build/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
