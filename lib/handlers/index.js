/* Modules */
const config = require('dos-config')
const log = require('debug')('astrotrain-manager:webhooks:index')
const partition = require('lodash/partition')
const PromiseReflect = require('promises-all')

const managers = require('./webhooks/managers')

/* Constants */
const DEVELOPMENT = config.env === 'development'
const STATUS_CODES = require('../constants/status-codes')
const WEBHOOK_STATUSES = require('../constants/webhook-statuses')

module.exports = async (req, res, next) => {

  const managersSummoned = getManagersSummoned(req.body)

  if (!managersSummoned.length) {
    res.sendStatus(202)
    return next()
  }

  log(`Managers got summoned, here is the list: ${managersSummoned.map(m => m.name)}`)

  const managersResults = await PromiseReflect.all(
    managersSummoned.map(manager => manager(req.body))
  )

  // Move this to an external testing module
  if (DEVELOPMENT) validateManagerResults(managersSummoned, managersResults)

  const managersResultsStatuses = getHTTPCategoriesFromManagerResults(managersResults)
  const webhookStatus = getWebhookStatus(managersResultsStatuses)

  log(`Managers summoned finished their duties: ${webhookStatus}`)

  res.sendStatus(webhookStatus.code)
  return next()
}

function getManagersSummoned(payload) {
  const managersKeys = Object.keys(managers)

  return managersKeys.reduce((acc, key) => {
    const manager = managers[key]
    const managerHandlesEvent = manager.schemas.find(schema => !schema(payload).error)
    return (managerHandlesEvent) ? acc.concat(manager.handler) : acc
  }, [])
}

function getHTTPCategoriesFromManagerResults(managersResults) {
  const allManagerResults = managersResults.resolve.concat(managersResults.reject)

  return allManagerResults.reduce((acc, result) => {
    const { code } = result
    if (code >= 100 && code < 200) acc.INFORMATIONAL.push(result)
    if (code >= 200 && code < 300) acc.SUCCESS.push(result)
    if (code >= 300 && code < 400) acc.REDIRECTION.push(result)
    if (code >= 400 && code < 500) acc.CLIENT_ERRORS.push(result)
    if (code >= 500) acc.SERVER_ERRORS.push(result)

    return acc
  }, {
      INFORMATIONAL: [],
      SUCCESS: [],
      REDIRECTION: [],
      CLIENT_ERRORS: [],
      SERVER_ERRORS: [],
    })
}

function getWebhookStatus(managersResultsStatuses) {
  const {
    INFORMATIONAL,
    SUCCESS,
    REDIRECTION,
    CLIENT_ERRORS,
    SERVER_ERRORS,
  } = managersResultsStatuses

  const SUCCEEDED_RESULTS = INFORMATIONAL.length || SUCCESS.length || REDIRECTION.length
  const FAILED_RESULTS = CLIENT_ERRORS.length || SERVER_ERRORS.length

  const WEBHOOK_SUCCESS = {
    code: STATUS_CODES.OK,
    status: WEBHOOK_STATUSES.SUCCESS,
  }
  const WEBHOOK_PARTIAL_SUCCESS = {
    code: STATUS_CODES.OK,
    status: WEBHOOK_STATUSES.PARTIAL_SUCCESS,
  }
  const WEBHOOK_FAILURE = {
    code: STATUS_CODES.BAD_REQUEST,
    status: WEBHOOK_STATUSES.FAILURE,
  }

  if (SUCCEEDED_RESULTS && !FAILED_RESULTS) return WEBHOOK_SUCCESS
  if (SUCCEEDED_RESULTS && FAILED_RESULTS) return WEBHOOK_PARTIAL_SUCCESS
  if (!SUCCEEDED_RESULTS && FAILED_RESULTS) return WEBHOOK_FAILURE
  return WEBHOOK_FAILURE
}

/* 
  This validation is supposed to fail during development, if an error
  from this function reaches production, it means the commiter didn't even
  tested the code in their local + the reviewer didn't even look at the 
  changes ❌.

  * Checks if the summoned Webhook Managers have the proper returning format
  * Proper format: "{ code: STATUS_CODE.OK, manager: manager.name }"
*/
function validateManagerResults(managersSummoned, managersResults) {
  const managersSummonedNamesList = managersSummoned.map(manager => manager.name)
  const statusCodesList = Object.values(STATUS_CODES)
  const allManagerResults = managersResults.resolve.concat(managersResults.reject)

  const [
    managersResultsThatAreObjects,
    managersResultsThatAreNotObjects
  ] = partition(
    allManagerResults,
    res => Object.prototype.toString.call(res) === '[object Object]'
  )

  if (managersResultsThatAreNotObjects.length) {
    throw new Error(`
      Hey, use the proper format for returning from a Webhook Manager!
      Correct format: "{ code: STATUS_CODE.OK, manager: manager.name }".
      Incorrect format: "null", "false", "200".
      Here is a list of the summoned managers for this event:
      ${JSON.stringify(managersSummonedNamesList)}
      Check them up, and update the returning format please...
    `)
  }

  const [
    managersResultsWithValidName,
    managersResultsWithoutValidName
  ] = partition(
    managersResultsThatAreObjects,
    res => res.manager && managersSummonedNamesList.includes(res.manager)
  )

  if (managersResultsWithoutValidName.length) {
    const managersNames = managersSummonedNamesList.filter(
      manager => !managersResultsWithValidName.includes(manager)
    )
    /* eslint-disable max-len */
    throw new Error(`
      Hey, you should always have a "manager" property in your returning object from a Webhook Manager!
      Correct format: "{ code: STATUS_CODE.OK, manager: manager.name }".
      Incorrect format: "{ code: STATUS_CODE.OK }".
      Here is a list of the summoned managers without a "manager" key in their returning object for this event:
      ${JSON.stringify(managersNames)}
      Check them up, and update the returning format please...
    `)
    /* eslint-enable max-len */
  }

  const [
    managersResultsWithValidStatusCode,
    managersResultsWithoutValidStatusCode
  ] = partition(
    managersResultsThatAreObjects,
    res => res.code && statusCodesList.includes(res.code)
  )

  if (managersResultsWithoutValidStatusCode.length) {
    /* eslint-disable max-len */
    throw new Error(`
      Hey, you should always have a valid "code" property in your returning object from a Webhook Manager!
      Correct format: "{ code: STATUS_CODE.OK, manager: manager.name }".
      Incorrect format: "{ manager: manager.name }".
      Have in mind that the status code you use, must be listed in "constants/status-codes" file.
      Here is a list of the summoned managers without a valid "code" key in their returning object for this event:
      ${JSON.stringify(managersResultsWithoutValidStatusCode)}
      Check them up, and update the returning format please...
    `)
    /* eslint-enable max-len */
  }

  const validManagerResults = managersResultsWithValidStatusCode

  return validManagerResults
}