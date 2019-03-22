/* Node modules */
const bodyParser = require('body-parser')
const config = require('dos-config')
const express = require('express')

/* Helpers & Middlewares modules */
const loader = require('./helpers/folder-loader')
const reqExtend = require('./middlewares/req-extend')
const secureHook = require('./middlewares/secure-hook')

const server = express()

/* Loaders */
const routes = loader('lib/modules', ['index.js'])

/* External middlewares */
server.use(bodyParser.json({ limit: config.bodyParser.limit }))
server.use(bodyParser.urlencoded({
  extended: true,
  limit: config.bodyParser.limit
}))

/* Pre middlewares */
server.use(secureHook)
server.use(reqExtend)

/* Routes */
routes.forEach(route => server.use(require(route)))

/* Start up the server */
server.listen(config.port, () => {
  console.log(`Listening on port ${config.port}`)
})

module.exports = server
