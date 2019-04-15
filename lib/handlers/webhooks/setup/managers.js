/* Schemas */
const schemas = require('../../../schemas/github/schemas-loader')

/* Helpers */
const newWebhookManager = require('../../../helpers/webhook-manager')

/* Webhooks handlers */
const backmergeConflictHandler = require('../backmerge-conflict-check')
const trainUpdateHandler = require('../train')

module.exports = {

  ...newWebhookManager(
    'BACKMERGE_CONFLICT',
    backmergeConflictHandler,
    schemas.pullRequest,
    schemas.checkRun,
  ),

  ...newWebhookManager(
    'TRAIN_UPDATE',
    trainUpdateHandler,
    schemas.pullRequest,
  )

}