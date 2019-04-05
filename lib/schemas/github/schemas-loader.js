const pullRequest = require('./events/pull-request')
const push = require('./events/push')

module.exports = {
  [pullRequest.name]: pullRequest,
  [push.name]: push,
}