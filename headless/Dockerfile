FROM mcr.microsoft.com/playwright:v1.52.0-noble
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY login.mjs .
CMD ["node", "login.mjs"]
