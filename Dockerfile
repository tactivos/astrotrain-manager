FROM node:10.15.3-alpine

ARG NPM_TOKEN

ENV NPM_TOKEN=$NPM_TOKEN \
  NODE_ENV=production

RUN npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN

WORKDIR /usr/src

COPY ["package.json", "package-lock.json", "/usr/src/"]

# Install only production dependencies
RUN npm install --only=production --loglevel=warn --progress=false --porcelain

COPY [".", "/usr/src/"]

EXPOSE 3000

CMD ["node", "index.js"]
