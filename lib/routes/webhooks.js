/* Modules */
const routes = require('express').Router();

/* Handlers */
const handler = require('../handlers');

/* Routes */
routes.post('/webhooks', handler);

module.exports = routes;
