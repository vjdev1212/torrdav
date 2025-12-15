FROM node:lts-alpine

WORKDIR /app

COPY package.json ./
COPY package-lock.json* ./

RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
