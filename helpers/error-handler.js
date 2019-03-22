/* Modules */
const config = require('dos-config');
const log = require('debug')('astrotrain-manager:errors');
const Rollbar = require("rollbar");
const rollbar = new Rollbar({
  accessToken: config.rollbar.token,
  environment: config.rollbar.env || config.env
});

/* Constants */
const LOG_TYPES = {
  DEBUG: 'debug',
  ERROR: 'error',
  INFO: 'info',
  CRITICAL: 'critical',
  WARNING: 'warning',
};
const LOG_TYPES_LIST = Object.keys(LOG_TYPES).map(k => LOG_TYPES[k]);

const reportMessage = (
  type = LOG_TYPES.INFO,
  msg,
  req = {},
  payload = {},
  cb = () => ({})
) => {

  if (!msg && (typeof msg !== 'string' || typeof msg !== 'object')) {
    throw new Error(`You must provide an message to handle an error!`);
  }

  if (!LOG_TYPES_LIST.includes(type)) {
    throw new Error(`Unknown logging type supplied: ${type}`);
  }

  log(msg);
  rollbar[type](msg, req, payload, cb);

};

const processExit = err => {
  // eslint-disable-next-line no-process-exit
  if (err) reportMessage(LOG_TYPES.CRITICAL, err, null, null, () => process.exit(1));
}

process.on('uncaughtException', processExit);
process.on('unhandledRejection', processExit);

module.exports = {
  reportMessage,
  LOG_TYPES,
};
