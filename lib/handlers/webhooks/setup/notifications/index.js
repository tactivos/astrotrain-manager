/* Modules */
const log = require('debug')('astrotrain-manager:handlers:setup:notifications')
const PromiseReflect = require('promises-all')

/* Notifications managers */
const getSlackNotifications = require('./slack')

/* Constants */
const NOTIFICATIONS_SERVICES = {
  SLACK: 'slack',
}
const NOTIFICATIONS_SERVICES_LIST = Object.values(NOTIFICATIONS_SERVICES)

const notificationsManager = async function notificationsManager(statuses) {

  const notifications = getNotificationsByService(statuses)

  const slackNotifications = getSlackNotifications(notifications.slack)

  const notificationsPromises = [
    ...slackNotifications,
  ]

  const notificationsResults = await getNotificationsResults(notificationsPromises)

  logNotificationStatus(notifications)

  return notificationsResults
}

/* Crazy falopa */
function getNotificationsByService(statuses) {
  const statusesKeys = Object.keys(statuses)
  return Object.values(NOTIFICATIONS_SERVICES).reduce((services, service) => {
    const notificationsByStatusAndService =
      statusesKeys.reduce((statusesResults, statusKey) => {

        const notificationsByService = statuses[statusKey].reduce((results, result) => {
          const serviceInResult = result.notifications && result.notifications[service]
          return serviceInResult ? results.concat(serviceInResult) : results
        }, [])

        return notificationsByService.length ? {
          ...statusesResults,
          [statusKey]: notificationsByService
        } : statusesResults

      }, {})

    return {
      ...services,
      [service]: notificationsByStatusAndService,
    }
  }, {})
}

function getNotificationsResults(...promises) {
  const flattenedPromises = [].concat(...promises)
  if (!flattenedPromises.length) return []
  return PromiseReflect.all(flattenedPromises)
}

function logNotificationStatus(notifications) {
  const services = Object.keys(notifications)
  const messages = [].concat(...Object.values(notifications).filter(obj =>
    Object.keys(obj).length)
  )

  if (!messages.length) return log(`Nothing to notify!`)

  const servicesNotificationsMessage = services.map(service => {
    const serviceName = service.charAt(0).toUpperCase() + service.slice(1)
    const statusesKeys = Object.keys(notifications[service])
    const notificationsForService = statusesKeys.reduce((acc, status) =>
      acc + notifications[service][status].length
      , 0)

    return `${serviceName}: ${notificationsForService}`
  })

  return log(`
Notifications sent!
Here is the list of notifications sent by service:
${servicesNotificationsMessage}`)
}

module.exports = {
  NOTIFICATIONS_SERVICES,
  NOTIFICATIONS_SERVICES_LIST,
  notificationsManager,
}