/* Modules */
const routes = require('express').Router();

/* Routes */
routes.get('/', (req, res) => res.status(200).send('Yeah! This is mural-harbour 😚'));

routes.get('/ping', (req, res) => res.sendStatus(200));

module.exports = routes;
