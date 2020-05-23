/* Modules */
const config = require('dos-config')

/* Constants */
const HTTP_CATEGORIES = require('../../../../constants/http-categories')
const { COLORS } = require('./constants')

/* Helpers */
const slack = require('../../../../helpers/slack')

/* Utils */
const { buildNotifications } = require('./utils')

const defaults = {
  color: COLORS.RED,
  title: `:scream: RELEASE TRAIN ERROR :scream:`,
}

module.exports = function getSlackNotifications(statuses) {
  return buildNotifications(statuses, (status, text) => {

    const options = getOptions(status)

    return slack.chat.postMessage({
      channel: config.slack.channels.releaseTrain,
      text: '',
      attachments: [{
        ...options,
        text,
      }],
    })
  })
}

function getOptions(status) {
  let options
  if (status === HTTP_CATEGORIES.CLIENT_ERRORS) options = getClientErrorOptions()
  if (status === HTTP_CATEGORIES.SUCCESS) options = getSuccessOptions()

  return {
    ...defaults,
    ...options,
  }
}

function getClientErrorOptions() {
  return {}
}

function getSuccessOptions() {
  return {
    color: COLORS.GREEN,
    title: `:steam_locomotive: RELEASE TRAIN UPDATE :steam_locomotive:`,
  }
}