/* Modules */
const config = require('dos-config');

/* Constants */
const error = 'Received an invalid request!';

/* Validators */
const validRequest = require('../validators/request');

module.exports = (req, res, next) => {
  const payload = getPayload(req.body);
  const secret = req.headers.token || payload.token;
  const signature = req.headers['x-hub-signature'];
  const url = req.originalUrl;

  if (
    !config.endpoints.whitelisted.includes(url) &&
    !validRequest(payload, secret, signature)
  ) {
    return res.status(400).send(error);
  }

  req.body = payload;

  return next();
}


// Slack interactive messages sends the payload object inside req.body.payload...
const getPayload = body => body.payload ? JSON.parse(body.payload) : body;
