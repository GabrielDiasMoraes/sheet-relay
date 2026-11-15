# Sheet Relay: relay + web app(s) in ONE image. Build context = repository root.
#   docker build -t sheet-relay .                                   (all systems)
#   docker build --build-arg SYSTEMS="dnd5e" -t sheet-relay .       (only some)
#   docker run -e SYSTEM=dnd5e -p 8787:8787 sheet-relay
# The web app is static JS: build it once on the builder architecture, not under emulation.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
ARG SYSTEMS="dnd5e fallout legends"
ARG BASE_PATH=/ficha
WORKDIR /repo
COPY shared shared
COPY systems systems
COPY scripts/build-app.mjs scripts/build-app.mjs
RUN for s in $SYSTEMS; do \
      (cd systems/$s/app && npm ci --no-audit --no-fund) && node scripts/build-app.mjs $s /out/$s --base $BASE_PATH || exit 1; \
    done

FROM node:22-alpine
ARG BASE_PATH=/ficha
WORKDIR /app
COPY relay/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --chown=node:node relay/server.js relay/static.js ./
COPY --from=build --chown=node:node /out /app/apps
ENV HOST=0.0.0.0 PORT=8787 SYSTEM=dnd5e BASE_PATH=${BASE_PATH} TRUST_PROXY=1
EXPOSE 8787
USER node
# SYSTEM picks which app to serve; RELAY_SECRET protects the module's WebSocket (set it!).
CMD ["sh", "-c", "STATIC_DIR=/app/apps/$SYSTEM exec node server.js"]
