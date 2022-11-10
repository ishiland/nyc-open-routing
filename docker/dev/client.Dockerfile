# base image
FROM node:16-alpine

ADD package.json /package.json

ENV NODE_PATH=/node_modules
ENV PATH=$PATH:/node_modules/.bin

RUN npm install --silent

WORKDIR /app
ADD . /app

ENTRYPOINT ["npm", "start"]
