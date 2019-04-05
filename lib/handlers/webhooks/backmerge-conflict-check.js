const config = require('dos-config')
const log = require('debug')('astrotrain-manager:webhooks:backmerge-conflict-check')
const getGithubInstance = require('../../helpers/github')
const ghApi = require('../../apis/github')

/* Constants */
const { EVENTS_LIST } = require('../../constants/github/pull-request-actions')
const STATUS_CODES = require('../../constants/status-codes')

//TODO: move this to it's own constants file
const ACTIONS = ['rerequested']
const CHECK_NAME = 'Backmerge conflict'
const CONFLICT_TITLE = 'Backmerge conflict'
const PLATFORM_REPO = config.platform.repo

module.exports = async function backmergeConflictManager(payload) {

  const manager = backmergeConflictManager.name

  const {
    action,
    check_run,
    installation,
    pull_request,
    repository,
    requested_action,
  } = payload

  log(`Action "${action}", Repo "${repository.name}"`)

  const check = check_run

  if (
    !EVENTS_LIST.includes(action) &&
    !(check && requested_action && ACTIONS.includes(requested_action.identifier))
  ) {
    return { code: STATUS_CODES.ACCEPTED, manager }
  }

  const github = await getGithubInstance(installation.id)
  const { base } = getDataFromEvent(check_run, pull_request)
  const owner = repository.owner.login

  try {

    const platformPR = await ghApi.getPlatformPR({
      github,
      base,
      owner,
      platformRepo: PLATFORM_REPO,
    })

    if (!platformPR) {
      log(`No PR found for base "${base}" in "${PLATFORM_REPO}" for "${owner}"`)
      return { code: STATUS_CODES.ACCEPTED, manager }
    }

    log(`Found PR for base "${base} in "${PLATFORM_REPO} for "${owner}`)

    const repos = await ghApi.listRepos(github, { perPage: 100 })

    log(`Repos found for "${owner}"'s installation: ${repos.length}`)

    const conflicts = await ghApi.getConflicts({
      github,
      base,
      repos,
      title: CONFLICT_TITLE,
    })

    log(`Conflicts: ${conflicts.length}`)

    if (!conflicts.length) {
      log(`Updating check "${CHECK_NAME}" for success`)
      await passCheckRun({ github, owner, repo: PLATFORM_REPO, platformPR })
      return { code: STATUS_CODES.ACCEPTED, manager }
    }

    log(`Updating check "${CHECK_NAME}" for failure`)
    await failCheckRun({
      github,
      owner,
      repo: PLATFORM_REPO,
      conflicts,
      platformPR,
    })

  } catch (e) {
    log(`Error updating check for "${owner}" installation`)
    return { code: STATUS_CODES.BAD_REQUEST, error: e, manager }
  }

  return { code: STATUS_CODES.OK, manager }
}

function getDataFromEvent(check, pr) {
  const base = (pr) ? pr.base.ref : check.pull_requests[0].base.ref
  const headSha = (pr) ? pr.head.sha : check.head_sha
  return { base, headSha }
}

async function passCheckRun({
  github,
  owner,
  repo,
  platformPR,
}) {
  return await ghApi.updateCheckRun({
    github,
    owner,
    repo,
    state: ghApi.buildCheckState({
      name: CHECK_NAME,
      status: 'completed',
      conclusion: 'success',
      headSha: platformPR.head.sha,
      completed_at: new Date().toISOString(),
      detailsUrl: `${platformPR.html_url}/checks`,
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
  platformPR,
  conflicts,
}) {

  const conflictsList = conflicts.map(c => `${c.html_url}\n`)

  return await ghApi.updateCheckRun({
    github,
    owner,
    repo,
    state: ghApi.buildCheckState({
      name: CHECK_NAME,
      status: 'completed',
      conclusion: 'failure',
      headSha: platformPR.head.sha,
      completed_at: new Date().toISOString(),
      detailsUrl: `${platformPR.html_url}/checks`,
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

const pluralize = list => list.length > 1 ? 's' : ''