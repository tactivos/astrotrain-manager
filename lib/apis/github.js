module.exports.listRepos = async function listRepos(github, { perPage }) {
  const response = await github.apps.listRepos({ per_page: perPage })
  return response.data.repositories
}

module.exports.getPlatformPR = async function getPlatformPR({
  github,
  base,
  owner,
  platformRepo
}) {

  const query = `\
is:pr+\
is:open+\
repo:${owner}/${platformRepo}+\
base:${base}\
`.trim()

  const { data } = await github.search.issuesAndPullRequests({ q: query })

  const found = data.items[0]

  if (!found) return null

  const platformPR = await github.pulls.get({
    owner,
    repo: platformRepo,
    number: found.number,
  })

  return platformPR.data
}

module.exports.getConflicts = async function getConflicts({
  github,
  base,
  repos,
  title
}) {

  const reposQuery = repos.map(repo => `repo:${repo.full_name}`).join('+')

  const query = `\
is:pr+\
is:open+\
${reposQuery}+\
base:${base}+\
${title}+in:title\
`.trim()

  const { data } = await github.search.issuesAndPullRequests({ q: query })
  return data.items
}

module.exports.updateCheckRun = function updateCheckRun({ github, owner, repo, state }) {
  return github.checks.create({
    owner,
    repo,
    ...state,
  })
}

module.exports.buildCheckState = function buildCheckState(opts = {}) {
  if (!opts.name) {
    throw new Error('"name" parameter is required for building check run state')
  }
  if (!opts.headSha) {
    throw new Error('"headSha" parameter is required for building check run state')
  }
  return {
    name: opts.name,
    status: opts.status || 'completed',
    conclusion: opts.conclusion || 'success',
    completed_at: opts.completedAt || new Date().toISOString(),
    head_sha: opts.headSha,
    details_url: opts.detailsUrl || null,
    output: {
      title: opts.output.title || `Everything is OK :thumbsup:`,
      summary: opts.output.summary || '',
      text: opts.output.text || ''
    },
    actions: (Array.isArray(opts.actions) && opts.actions.length) ? opts.actions : [{
      label: 'Trigger again',
      description: 'Retrigger the backmerge conflict checker',
      identifier: 'rerequested',
    }]
  }
}