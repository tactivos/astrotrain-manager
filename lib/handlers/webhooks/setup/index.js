/* Modules */
const config = require('dos-config')
const log = require('debug')('astrotrain-manager:handlers:setup')
const PromiseReflect = require('promises-all')

/* Setup */
const {
  validateManagerResults,
  getHTTPCategoriesFromManagerResults,
  getWebhookStatus,
} = require('./managers-results-utils')
const managers = require('./managers')
const { notificationsManager } = require('./notifications')

/* Constants */
const DEVELOPMENT = config.env === 'development'

module.exports = async (message) => {

  const payload = message.messageText

  const { managersSummoned, schema } = getManagersSummoned(payload)

  if (!managersSummoned.length) {
    return log(`No managers summoned for this payload`)
  }

  log(`Managers got summoned, here is the list: ${managersSummoned.map(m => m.name)}`)

  const managersResults = await PromiseReflect.all(
    managersSummoned.map(manager => manager(payload))
  )

  // Move this to an external testing module
  if (DEVELOPMENT) validateManagerResults(managersSummoned, managersResults)

  const managersResultsStatuses = getHTTPCategoriesFromManagerResults(managersResults)
  const webhookStatus = getWebhookStatus(managersResultsStatuses)

  log(`
    Managers summoned finished their duties for schema "${schema}".
    Here is the list of the executed ones with their result:
    ${JSON.stringify(managersResultsStatuses, null, 2)}

    Conclusion: ${JSON.stringify(webhookStatus)}
  `)

  await postManagersTasks(managersResultsStatuses, webhookStatus)
}

function getManagersSummoned(payload) {
  const managersKeys = Object.keys(managers)

  return managersKeys.reduce((acc, key) => {
    const manager = managers[key]
    const eventSchema = manager.schemas.find(schema => !schema(payload).error)

    return (eventSchema) ? {
      ...acc,
      managersSummoned: acc.managersSummoned.concat(manager.handler),
      schema: eventSchema.name,
    } : acc
  }, {
      managersSummoned: [],
      schema: null,
    })
}

async function postManagersTasks(statuses) {
  await notificationsManager(statuses)
}
