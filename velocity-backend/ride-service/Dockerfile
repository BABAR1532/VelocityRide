FROM node:18-bullseye-slim
WORKDIR /workspace/ride-service
COPY ride-service/package.json ride-service/package-lock.json* ./
RUN npm install --omit=dev
COPY shared /workspace/shared
COPY ride-service/ ./
EXPOSE 3003
CMD ["node", "src/index.js"]
