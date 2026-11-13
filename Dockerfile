FROM node:20-slim

WORKDIR /app

# تثبيت متطلبات النظام
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]

