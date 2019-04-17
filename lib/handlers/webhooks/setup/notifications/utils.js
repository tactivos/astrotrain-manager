module.exports.buildNotifications = function buildNotifications(statuses, cb) {
  const statusesKeys = Object.keys(statuses)

  if (!statusesKeys.length) return []

  return statusesKeys.reduce((acc, status) => {
    const promises = statuses[status].map(message => cb(status, message, statuses))
    return acc.concat(promises)
  }, [])
}