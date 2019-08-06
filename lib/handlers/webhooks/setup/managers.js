/* Schemas */
const schemas = require('../../../schemas/github/schemas-loader')

/* Helpers */
const newWebhookManager = require('../../../helpers/webhook-manager')

/* Webhooks handlers */
const backmergeHandler = require('../backmerge')
// const backmergeConflictHandler = require('../backmerge-conflict-check')
const manifestUpdateHandler = require('../manifest-update')
const trainUpdateHandler = require('../train')

module.exports = {

  ...newWebhookManager(
    'BACKMERGE',
    backmergeHandler,
    schemas.push,
  ),

  // ...newWebhookManager(
  //   'BACKMERGE_CONFLICT',
  //   backmergeConflictHandler,
  //   schemas.pullRequest,
  //   schemas.checkRun,
  // ),

  ...newWebhookManager(
    'MANIFEST_UPDATE',
    manifestUpdateHandler,
    schemas.push,
  ),

  ...newWebhookManager(
    'TRAIN_UPDATE',
    trainUpdateHandler,
    schemas.pullRequest,
  ),

}