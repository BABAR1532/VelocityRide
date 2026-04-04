FROM node:18-bullseye-slim
WORKDIR /workspace/parcel-service
COPY parcel-service/package.json parcel-service/package-lock.json* ./
RUN npm install --omit=dev
COPY shared /workspace/shared
COPY parcel-service/ ./
EXPOSE 3005
CMD ["node", "src/index.js"]
