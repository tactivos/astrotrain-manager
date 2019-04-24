exports.buildManifestUpdateSuccessNotification =
  function buildTrainUpdateSuccessNotification({
    head,
    repo,
    pr,
  }) {

    const checkPr = pr ? `Check the PR <${pr.html_url}|here>` : ''

    const slackMessage = `
Manifest update successful on \`${head}\` for \`${repo}\` :kissing_smiling_eyes:
${checkPr}
`.trim()

    return {
      slack: slackMessage,
    }
  }

exports.buildManifestUpdateFailureNotification =
  function buildTrainUpdateFailureNotification({
    head,
    repo,
    error,
  }) {

    const slackMessage = `
Error updating manifest on \`${head}\` for \`${repo}\` :scream:

*Error:*
\`\`\`${error.stack}\`\`\`
`.trim()

    return {
      slack: slackMessage,
    }
  }