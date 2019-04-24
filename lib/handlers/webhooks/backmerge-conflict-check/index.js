/* Modules*/
const config = require('dos-config')
const log = require('debug')('astrotrain-manager:webhooks:backmerge-conflict-check')

/* API's */
const ghApi = require('../../../apis/github')

/* Constants */
const { EVENTS_LIST } = require('../../../constants/github/pull-request-actions')
const STATUS_CODES = require('../../../constants/http-status-codes')
const {
  ACTIONS,
  CHECK_NAME,
  CONFLICT_TITLE,
} = require('./constants')
const PLATFORM_REPO = config.platform.repo

/* Helpers */
const getGithubInstance = require('../../../helpers/github')

/* Notifications */
const { buildUpdateFailureNotification } = require('./notifications')

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

  const check = check_run

  if (
    !EVENTS_LIST.includes(action) &&
    !(check && requested_action && ACTIONS.includes(requested_action.identifier))
  ) {
    return { code: STATUS_CODES.ACCEPTED, manager }
  }

  log(`Manager ${manager} was summoned!`)

  const github = await getGithubInstance(installation.id)
  const { base } = getDataFromEvent(check_run, pull_request)
  const owner = repository.owner.login

  let platformPR

  try {

    platformPR = await ghApi.getPlatformPR({
      github,
      base,
      owner,
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

  } catch (error) {
    /* eslint-disable */
    log(`
      Error updating check "${CHECK_NAME}" for "${owner}" installation in method ${manager}.
      ${(platformPR) ? `Please try retriggering it <${platformPR.html_url}/checks|here>.` : ''}
      ${error}`)
    /* eslint-enable */

    const notifications = buildUpdateFailureNotification({
      checkName: CHECK_NAME,
      owner,
      manager,
      platformPR,
      error,
    })

    return { code: STATUS_CODES.BAD_REQUEST, manager, notifications }
  }

  return { code: STATUS_CODES.OK, manager }
}

function getDataFromEvent(check, pr) {
  const base = (pr) ? pr.base.ref : check.pull_requests[0].base.ref
  return { base }
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