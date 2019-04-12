/* Deps */
const config = require('dos-config');
const Slack = require('slack');

const client = new Slack({ token: config.slack.token });

module.exports = client;