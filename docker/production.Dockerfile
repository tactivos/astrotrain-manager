FROM node:10.15.3-alpine

ENV NODE_ENV=production

WORKDIR /usr/src

COPY ["package.json", "package-lock.json", "key.pem", "/usr/src/"]

# Install only production dependencies
RUN npm install --only=production --loglevel=warn --progress=false --porcelain

COPY [".", "/usr/src/"]

EXPOSE 3000

CMD ["node", "index.js"]
