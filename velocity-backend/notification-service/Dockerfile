FROM node:18-bullseye-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3006
CMD ["node", "src/index.js"]
