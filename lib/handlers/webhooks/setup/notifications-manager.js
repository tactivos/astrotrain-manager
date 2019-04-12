/* Modules */
const config = require('dos-config')
const log = require('debug')('astrotrain-manager:handlers:setup:notifications-manager')
const PromiseReflect = require('promises-all')

/* Helpers */
const slack = require('../../../helpers/slack')

const NOTIFICATIONS_SERVICES = {
  SLACK: 'slack',
}
const NOTIFICATIONS_SERVICES_LIST = Object.values(NOTIFICATIONS_SERVICES)

const notificationsManager = async function notificationsManager(statuses) {
  const notifications = getDistributedNotificationsByService(statuses)

  const slackNotifications = getSlackNotifications(notifications.slack)

  const notificationsPromises = [
    ...slackNotifications,
  ]

  const notificationsResults = await getNotificationsResults(notificationsPromises)

  logNotificationStatus(notifications)

  return notificationsResults
}

/* Crazy falopa 👇 */
function getDistributedNotificationsByService(statuses) {
  const statusesKeys = Object.keys(statuses)
  const notificationsFound = statusesKeys.reduce((acc, status) => {
    const notifications = statuses[status].reduce((acc, result) =>
      result.notifications ? acc.concat(result.notifications) : acc
      , [])
    return notifications.length ? acc.concat(notifications) : acc
  }, [])

  return notificationsFound.reduce((acc, notification) => {
    Object.keys(notification).forEach(service => {
      if (!acc[service]) acc[service] = [notification[service]]
      else acc[service].push(notification[service])
    })
    return acc
  }, {})
}

function getNotificationsResults(...promises) {
  const flattenedPromises = [].concat(...promises)
  if (!flattenedPromises.length) return []
  return PromiseReflect.all(flattenedPromises)
}

function logNotificationStatus(notifications) {
  const services = Object.keys(notifications)
  const messages = [].concat(...Object.values(notifications))

  if (!messages.length) return log(`Nothing to notify!`)

  const servicesNotificationsMessage = services.map(service => {
    const serviceName = service.charAt(0).toUpperCase() + service.slice(1)
    return `${serviceName}: ${notifications[service].length}`
  })

  return log(`
Notifications sent!
Here is the list of notifications sent by service:
${servicesNotificationsMessage}`)
}

function getSlackNotifications(messages) {

  if (!messages || !Array.isArray(messages)) return []

  const preSlackMessage = `😱 *RELEASE TRAIN ERROR* 😱`
  const colorRed = '#FF0000'

  return messages.map(text => slack.chat.postMessage({
    channel: config.slack.channels.releaseTrain,
    text: '',
    attachments: [{
      color: colorRed,
      title: preSlackMessage,
      text,
    }],
  }))
}

module.exports = {
  NOTIFICATIONS_SERVICES,
  NOTIFICATIONS_SERVICES_LIST,
  notificationsManager,
}