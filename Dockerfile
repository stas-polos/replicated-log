FROM node:22-slim

RUN groupadd -r webservice && useradd --no-log-init -r -g webservice webservice

WORKDIR /app

COPY package*.json ./
COPY config.yaml ./

RUN npm install

COPY shared/ ./shared/
COPY src/ ./src/

CMD ["node"]
