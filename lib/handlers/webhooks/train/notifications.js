/* Modules */
const config = require('dos-config')

/* Constants */
const PLATFORM_REPO = config.platform.repo

module.exports.buildNotFFNotification = function buildNotFFNotification({
  base,
  head,
  manager,
  owner,
  prs,
}) {

  const notFFRepos = prs.map(c => `\`${c.repo}\``)

  /* eslint-disable */
  const slackMessage = `
Error updating train from \`${head}\` to \`${base}\`

Installation: *${owner}*
Method: \`${manager}\`

Here is the error for debugging purposes:

The \`${base}\` branch in these repos can't be fast-forwarded to \`${head}\`'s HEAD: ${notFFRepos.join(',')}
`
  /* eslint-enable */

  return {
    slack: slackMessage,
  }
}

exports.buildTrainUpdateSuccessNotification =
  function buildTrainUpdateSuccessNotification({
    base,
    platformPr = {},
    repository,
  }) {

    const checkPrMsg = base !== config.platform.branch.stable
      ? `You can check the new changes that went with it <${platformPr.html_url}|here>`
      //eslint-disable-next-line max-len
      : `You can check the new changes that went with it <${buildManifestFileUrl(repository, base)}|here>`

    const slackMessage = `
*TRAIN FOR \`${base.toUpperCase()}\` HAS DEPARTED :steam_locomotive:*
${checkPrMsg}

This notification only means that all the codebases are updated correctly.
For deployment updates check the #deploys channel.
`.trim()

    return {
      slack: slackMessage,
    }
  }

exports.buildTrainUpdateFailureNotification =
  function buildTrainUpdateFailureNotification({
    error
  }) {

    const slackMessage = `

*Error:*
\`\`\`${error.stack}\`\`\`
`.trim()

    return {
      slack: slackMessage,
    }
  }

function buildManifestFileUrl(repo, branch) {
  return `${repo.html_url}/blob/${branch}/${PLATFORM_REPO}`
}