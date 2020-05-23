/* Node modules */
const bodyParser = require('body-parser')
const config = require('dos-config')
const express = require('express')

/* Helpers */
const loader = require('./lib/helpers/folder-loader')
const { processMessages } = require('./lib/helpers/queue')
require('./lib/helpers/rollbar')()

/* Middlewares */
const reqExtend = require('./lib/middlewares/req-extend')
const secureHook = require('./lib/middlewares/secure-hook')

const webhooksManager = require('./lib/handlers/webhooks/setup')

const server = express()

/* Loaders */
const routes = loader('lib/routes')

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

const run = async () => {
  processMessages(webhooksManager);
  setTimeout(run, config.setup.interval);
};

/* Start up the server */
server.listen(config.port, () => {
  console.log(`Listening on port ${config.port}`)
  run()
  console.log(`Message processor is ready`)
})

module.exports = server
