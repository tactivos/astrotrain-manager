/* Schemas */
const schemas = require('../../../schemas/github/schemas-loader')

/* Helpers */
const newWebhookManager = require('../../../helpers/webhook-manager')

/* Webhooks handlers */
const backmergeConflictHandler = require('../backmerge-conflict-check')

module.exports = {

  ...newWebhookManager(
    'BACKMERGE_CONFLICT',
    backmergeConflictHandler,
    schemas.pullRequest,
  )

}