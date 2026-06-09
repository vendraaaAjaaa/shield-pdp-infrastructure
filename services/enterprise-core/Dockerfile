FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && addgroup -S app \
    && adduser -S -G app app

COPY src ./src

USER app
EXPOSE 8080

CMD ["node", "src/server.js"]
