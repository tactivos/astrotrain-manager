const config = require('dos-config')
const Rollbar = require('rollbar')

const {
  accessToken,
  env,
  captureUncaught,
  captureUnhandledRejections,
} = config.rollbar;

module.exports = () => {
  Rollbar.init({
    accessToken,
    captureUncaught,
    captureUnhandledRejections,
    environment: env || config.env,
    verbose: true,
  });
  return Rollbar;
};