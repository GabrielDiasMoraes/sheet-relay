FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js static.js ./
ENV HOST=0.0.0.0
CMD ["node", "server.js"]
