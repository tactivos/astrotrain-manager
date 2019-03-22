const config = require('dos-config')
const log = require('debug')('astrotrain-manager:webhook')
const getGithubInstance = require('../../../../helpers/github')

/* Constants */
const { EVENTS_LIST } = require('../../../constants/pull-request-events')

const ACTIONS = ['rerequested']
const CHECK_NAME = 'Backmerge conflict'
const CONFLICT_TITLE = 'Backmerge conflict'
const PLATFORM_REPO = config.platform.repo

module.exports = async function webhookManager(req, res, next) {

  const {
    action,
    check_run,
    installation,
    pull_request,
    repository,
    requested_action,
  } = req.body

  log(`Action "${action}", Repo "${repository.name}"`)

  const check = check_run

  if (
    !EVENTS_LIST.includes(action) &&
    !(check && requested_action && ACTIONS.includes(requested_action.identifier))
  ) {
    res.sendStatus(202)
    return next()
  }

  const github = await getGithubInstance(installation.id)
  const { base } = getDataFromEvent(check_run, pull_request)
  const owner = repository.owner.login

  try {

    const platformPR = await getPlatformPR({ github, base, owner })

    if (!platformPR) {
      log(`No PR found for base "${base}" in "${PLATFORM_REPO}" for "${owner}"`)
      res.sendStatus(202)
      return next()
    }

    log(`Found PR for base "${base} in "${PLATFORM_REPO} for "${owner}`)

    const headSha = platformPR.head.sha
    const repos = await getRepos(github, { perPage: 100 })

    log(`Repos found for "${owner}"'s installation: ${repos.length}`)

    const conflicts = await getConflicts({
      github,
      base,
      repos,
    })

    log(`Conflicts: ${conflicts.length}`)

    if (!conflicts.length) {
      log(`Updating check "${CHECK_NAME}" for success`)
      await passCheckRun({ github, owner, repo: PLATFORM_REPO, headSha })
      res.sendStatus(202)
      return next()
    }

    log(`Updating check "${CHECK_NAME}" for failure`)
    await failCheckRun({ github, owner, repo: PLATFORM_REPO, headSha, conflicts })

  } catch (e) {
    log(`Error updating check for "${owner}" installation`)
    console.log(e)
  }

  res.sendStatus(200)
  return next()
}

async function getRepos(github, { perPage }) {
  const response = await github.apps.listRepos({ per_page: perPage })
  return response.data.repositories
}

async function getPlatformPR({ github, base, owner }) {

  const query = `\
is:pr+\
is:open+\
repo:${owner}/${PLATFORM_REPO}+\
base:${base}\
`.trim()

  const { data } = await github.search.issuesAndPullRequests({ q: query })

  const found = data.items[0]

  if (!found) return null

  const platformPR = await github.pulls.get({
    owner,
    repo: PLATFORM_REPO,
    number: found.number,
  })

  return platformPR.data
}

async function getConflicts({ github, base, repos }) {

  const reposQuery = repos.map(repo => `repo:${repo.full_name}`).join('+')

  const query = `\
is:pr+\
is:open+\
${reposQuery}+\
base:${base}+\
${CONFLICT_TITLE}+in:title\
`.trim()

  const { data } = await github.search.issuesAndPullRequests({ q: query })

  return data.items
}

function getDataFromEvent(check, pr) {
  const base = (pr) ? pr.base.ref : check.pull_requests[0].base.ref
  const headSha = (pr) ? pr.head.sha : check.head_sha
  return { base, headSha }
}

function updateCheckRun({ github, owner, repo, headSha, state }) {
  return github.checks.create({
    owner,
    repo,
    name: CHECK_NAME,
    head_sha: headSha,
    ...state,
  })
}

async function passCheckRun({
  github,
  owner,
  repo,
  headSha,
}) {
  return await updateCheckRun({
    github,
    owner,
    repo,
    headSha,
    state: buildCheckState({
      status: 'completed',
      conclusion: 'success',
      completed_at: new Date().toISOString(),
      output: {
        title: `Everything is OK :D`,
        summary: '',
        text: 'No conflicts found, please go ahead and merge',
      },
    })
  })
}

async function failCheckRun({
  github,
  owner,
  repo,
  headSha,
  conflicts,
}) {

  const conflictsList = conflicts.map(c => `${c.html_url}\n`)

  return await updateCheckRun({
    github,
    owner,
    repo,
    headSha,
    state: buildCheckState({
      status: 'completed',
      conclusion: 'failure',
      completed_at: new Date().toISOString(),
      output: {
        //eslint-disable-next-line max-len
        title: `Found ${conflicts.length} conflict${pluralize(conflicts)} across the platform`,
        summary: 'Please, fix the conflicts found, then re-trigger this check.',
        text: `
Conflicts:
${conflictsList}
`,
      },
    })
  })
}

const buildCheckState = (opts = {}) => ({
  status: opts.status || 'completed',
  conclusion: opts.conclusion || 'success',
  completed_at: opts.completedAt || new Date().toISOString(),
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
})

const pluralize = list => list.length > 1 ? 's' : ''