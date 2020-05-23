const checkRun = require('./events/check-run')
const pullRequest = require('./events/pull-request')
const push = require('./events/push')

module.exports = {
  [checkRun.name]: checkRun,
  [pullRequest.name]: pullRequest,
  [push.name]: push,
}