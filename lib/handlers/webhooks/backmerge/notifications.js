/* Modules */
const ghApi = require('../../../apis/github')

exports.buildBackmergeSuccessNotification =
  function buildBackmergeSuccessNotification({
    back,
    head,
    conflictPrs,
    failures,
    merges,
    owner,
  }) {

    const backmergeResultsMessages = getBackmergeResultMessages({
      conflictPrs,
      failures,
      merges,
      owner,
    })

    const slackMessage = `
Results of backmerging \`${head}\` into \`${back}\`:

${backmergeResultsMessages}
`

    return {
      slack: slackMessage,
    }
  }

function getBackmergeResultMessages({
  conflictPrs,
  failures,
  merges,
  owner,
}) {

  const results = [
    getSuccessAttachment(merges),
    getConflictAttachment(conflictPrs),
    getFailuresAttachment(failures, owner)
  ]

  // sanitise results; empty objects will be removed
  return results.filter(r => Object.keys(r).length > 0)
}

function getSuccessAttachment(backmerges) {
  if (!backmerges.length) return {}

  /* eslint-disable */
  const messages = backmerges.map((b, i) => `
  ${i + 1}) *${b.repo}*: New head: <${b.data.html_url}|${ghApi.getShortSha(b.data.sha)}>
`)
  /* eslint-enable */

  return `Successful backmerges :white_check_mark:: ${messages}`
}

function getConflictAttachment(prs) {
  if (!prs.length) return {}

  /* eslint-disable */
  const messages = prs.map((pr, i) => `
  ${i + 1}) *${pr.repo}*: PR <${pr.data.html_url}|#${pr.data.number}> created. Ping *@${pr.data.user.login}* to fix it!
`)
  /* eslint-enable */

  return `Conflicted backmerges :triumph:: ${messages}`
}

function getFailuresAttachment(failures, owner) {
  if (!failures.length) return {}

  const messages = failures.map((f, i) =>
    ` ${i + 1}) *<${getRepoUrl(owner, f.repo)}|${f.repo}>*`
  )

  return `:scream: Failed backmerges :scream:: ${messages}`
}

function getRepoUrl(owner, repo) {
  return `https://github.com/${owner}/${repo}`
}

exports.buildBackmergeFailureNotification = function buildBackmergeFailureNotification({
  back,
  head,
  error,
  repo,
}) {

  const slackMessage = `

There was an error backmerging on \`${repo}\` from \`${head}\` to \`${back}\`.
Please contact the team managing astrotrain.

*Error:*
\`\`\`${error.stack}\`\`\`
`.trim()

  return {
    slack: slackMessage,
  }
}