module.exports.buildUpdateFailureNotification = function buildUpdateFailureNotification({
  checkName,
  owner,
  manager,
  platformPR,
  error,
}) {
  /* eslint-disable */
  const slackMessage = `
Error updating check \`${checkName}\`

Installation: *${owner}*
Method: \`${manager}\`

${(platformPR) ? `Please try retriggering it <${platformPR.html_url}/checks|here>.` : ''}

Here is the error for debugging purposes:
\`\`\`${error}\`\`\`
`
  /* eslint-enable */

  return {
    slack: slackMessage,
  }
}