from node:dubnium

RUN mkdir /app

WORKDIR /app

EXPOSE 8080

COPY package*.json ./

RUN npm install

COPY *.jsont ./
COPY *.html ./
COPY *.js ./

CMD [ "node", "server.js" ]
