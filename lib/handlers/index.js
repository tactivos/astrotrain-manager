/* Modules */
const queue = require('../helpers/queue')

/* Schemas */
const schemas = require('../schemas/github/schemas-loader')

module.exports = async (req, res, next) => {

  const payload = req.body

  const validPayload = validatePayload(payload)

  if (!validPayload) {
    res.status(202).send(`We don't have a valid schema for this payload yet!`)
    return next()
  }

  const event = validPayload

  await queue.createMessage(event)

  res.sendStatus(200)
  return next()
}

const validatePayload = payload => {
  const validSchema = Object.keys(schemas).find(schema => !schemas[schema].error)
  if (!validSchema) return null
  return schemas[validSchema](payload).value
}