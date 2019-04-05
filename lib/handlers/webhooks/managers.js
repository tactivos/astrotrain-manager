/* Schemas */
const schemas = require('../../schemas/github/schemas-loader')

/* Webhooks handlers */
const backmergeConflictHandler = require('./backmerge-conflict-check')

module.exports = {

  ...newWebhookManager(
    'BACKMERGE_CONFLICT',
    backmergeConflictHandler,
    schemas.pullRequest,
  )

}

function newWebhookManager(
  name = '',
  handler = null,
  ...schemasArr
) {

  if (!name || typeof name !== 'string' || !name.length) {
    throw new Error('"name" param must be a valid string!')
  }

  if (!handler || typeof handler !== 'function' || !handler.name) {
    throw new Error(`"handler" param must be a valid named function!
    Please check "${name}" definition`)
  }

  if (!Array.isArray(schemasArr) || !schemasArr.length) {
    throw new Error(`"schemas" param must be an array with 1 or more items! 
    Please check "${name}" definition`)
  }

  const schemasNames = Object.keys(schemas)
  const invalidSchema = schemasArr.find(schema =>
    typeof schema !== 'function' || !schemasNames.includes(schema.name))

  if (invalidSchema) {
    throw new Error(`
    "schemas" param must be composed of schemas defined inside "schemas" directory.
    Here is the invalid schema found:
    ${invalidSchema}`)
  }

  return {
    [name]: {
      schemas: [].concat(...schemasArr),
      handler,
    }
  }
}