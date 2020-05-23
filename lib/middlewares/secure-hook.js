/* Modules */
const config = require('dos-config');
const crypto = require('crypto');

/* Constants */
const TOKENS = Object.values(config.tokens);
const DEVELOPMENT = config.env === 'development'
const error = 'Received an invalid request!';

module.exports = (req, res, next) => {
  const payload = getPayload(req.body);
  const secret = req.headers.token || payload.token;
  const signature = req.headers['x-hub-signature'];
  const url = req.originalUrl;

  if (
    !DEVELOPMENT &&
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

function validRequest(payload, secret, sign) {

  /*
    We need to have one or the other for secret and sign,
    but we can't have both of them at the same time
  */
  if ((!secret && !sign) || (secret && sign)) return false;

  if (typeof payload !== 'object') return false;

  if (secret && typeof secret === 'string')
    return secureTokenHook(secret);

  if (sign && typeof sign === 'string')
    return secureGithubHook(sign, config.github.secret, JSON.stringify(payload));

  return false;

}

/* Slack */
const secureTokenHook = secret => TOKENS.indexOf(secret) !== -1;

/* Github */
const secureGithubHook = (sign, secret, payload) =>
  bufferEq(new Buffer(sign), new Buffer(signBlob(secret, payload)));

const signBlob = (key, blob) =>
  `sha1=${crypto.createHmac('sha1', key).update(blob, 'utf-8').digest('hex')}`

const bufferEq = (buffer, buffer2) => {
  if (!Buffer.isBuffer(buffer) || !Buffer.isBuffer(buffer2)) return undefined;
  if (typeof buffer.equals === 'function') return buffer.equals(buffer2);
  if (buffer.length !== buffer2.length) return false;

  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] !== buffer2[i]) return false;
  }

  return true;
}
