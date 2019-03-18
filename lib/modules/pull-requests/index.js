/* Modules */
const routes = require('express').Router();

/* Handlers */
const shipit = require('./handlers/shipit');

/* Routes */
routes.post('/shipit', shipit);

module.exports = routes;
