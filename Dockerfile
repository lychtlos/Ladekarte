FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/daten/ladekarte.db
VOLUME ["/daten"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/api/status || exit 1

CMD ["node", "server/server.js"]
