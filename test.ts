import setup from '../src/src/setup';

const config = require('dos-config');
config.slack = {};
config.platform = {
  manifest: '',
  repo: '',
};
config.github.appId = '37765';
config.github.privateKeyPath = '../../../../train/test.pem';
config.github.secret = '8eeadd34bcaa121e575367caba365d9dd96194f3';

const webhooksManager = require('./lib/handlers/webhooks/setup')


setup(
  ({ When }) => {
    When('receiving a webhook with', payload => {
      const message = JSON.parse(payload);
      return webhooksManager(message);
    }, { inline: true });
  },
  { usage: true }
);
