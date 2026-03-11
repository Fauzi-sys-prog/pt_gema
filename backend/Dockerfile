FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

EXPOSE 3000 5555

CMD ["npm", "run", "dev"]