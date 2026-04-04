FROM node:18-bullseye-slim
WORKDIR /workspace/carpool-service
COPY carpool-service/package.json carpool-service/package-lock.json* ./
RUN npm install --omit=dev
COPY shared /workspace/shared
COPY carpool-service/ ./
EXPOSE 3004
CMD ["node", "src/index.js"]
