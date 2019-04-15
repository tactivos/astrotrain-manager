/* Modules*/
const config = require('dos-config')
const log = require('debug')('astrotrain-manager:webhooks:train')
const getGithubInstance = require('../../../helpers/github')
const ghApi = require('../../../apis/github')

/* Constants */
const STATUS_CODES = require('../../../constants/status-codes')
const { ACTIONS } = require('./constants')
const DEVELOPMENT = config.env === 'development'
const PLATFORM_REPO = config.platform.repo

/* Notifications */
const {
  buildNotFFNotification,
  buildTrainUpdateFailureNotification,
  buildTrainUpdateSuccessNotification,
} = require('./notifications')

module.exports = async function trainManager(payload) {

  const manager = trainManager.name

  const {
    action,
    pull_request,
    installation,
    repository,
  } = payload

  const base = pull_request.base.ref
  const head = pull_request.head.ref
  const { merged } = pull_request
  const owner = repository.owner.login

  if (
    repository.name !== PLATFORM_REPO ||
    !Object.values(config.platform.branch).includes(base) ||
    !ACTIONS.includes(action) ||
    !merged
  ) {
    return { code: STATUS_CODES.ACCEPTED, manager }
  }

  log(`Manager ${manager} was summoned!`)

  try {
    const github = await getGithubInstance(installation.id)

    const existingPr = await ghApi.getPlatformPR({
      github,
      base,
      owner,
    })

    const repos = DEVELOPMENT ?
      ['release-train-testing'] :
      await ghApi.listRepos(github, { perPage: 100 })

    const comparisons = await ghApi.getComparisons({ github, base, head, owner, repos })

    // consider only those repos that aren't already up-to-date
    const updatableRepos = comparisons.filter(c => !isUpToDate(c.data))

    // ensure all updatable repos are fast-forwardable; fail otherwise
    const notFF = updatableRepos.filter(c => !isFastForward(c.data))

    if (notFF.length > 0) {
      //eslint-disable-next-line max-len
      log(`The ${base} branch in these repos can't be fast-forwarded to ${head}'s HEAD: ${notFF.map(c => c.repo)}`)
      const notifications = buildNotFFNotification({
        base,
        head,
        manager,
        owner,
        prs: notFF
      })
      return { code: STATUS_CODES.BAD_REQUEST, manager, notifications }
    }

    log(`Updating ${base} in ${updatableRepos.map(c => c.repo)}`)

    // update component repos base ref with new HEAD
    const updates = await Promise.all(updatableRepos.map(async c => {
      log(`Updating repo ${c.repo}`)

      const { data } = await github.gitdata.updateReference({
        owner,
        repo: c.repo,
        ref: `heads/${base}`,
        sha: c.data.commits[c.data.commits.length - 1].sha
      })

      return { repo: c.repo, data }
    }))

    // only create platform repo PR if we're not updating stable
    if (base !== config.platform.branch.stable) {

      const manifest = ghApi.generateCurrentManifest(comparisons)

      const updatesFormatted = updates.map(u => ({
        repo: u.repo,
        sha: u.data.object.sha,
      }))

      // create new commit in platorm repo with updates to manifest file
      await ghApi.updateManifest({
        github,
        branch: base,
        manifest,
        owner,
        updates: updatesFormatted,
      })

      // finally, ensure a platform update PR exists
      const pr = await (existingPr || ghApi.createPlatformUpdatePr({
        github,
        base,
        head,
        owner,
      }))

      log(`Pull request ${pr.title} created/updated at ${pr.html_url}`)

      const notifications = buildTrainUpdateSuccessNotification({
        base,
        platformPr: pr,
        repository,
      })

      return { code: STATUS_CODES.OK, manager, notifications }
    }

    const notifications = buildTrainUpdateSuccessNotification({
      base,
      repository,
    })

    log(`Updated ${head} in ${updatableRepos.map(c => c.repo)}`)
    return { code: STATUS_CODES.OK, manager, notifications }
  } catch (error) {
    /* eslint-disable */
    log(`
      Error updating train from "${head}" to "${base}" for "${owner}"'s installation in method ${manager}.
      Fix the error and retrigger the Github Webhook!
      ${error}`)
    /* eslint-enable */

    const notifications = buildTrainUpdateFailureNotification({ error })

    return { code: STATUS_CODES.BAD_REQUEST, manager, notifications }
  }
}

/**
 * Indicates whether the HEAD of a branch comparison
 * is up to date with the provided base (i.e.: if both
 * refs are referencing the same SHA)
 *
 * @param  {Object} comparison a github branch comparison
 * @return {Boolean}  if the comparison is up-to-date
 */
function isUpToDate(comparison) {
  return !requiresMergeCommit(comparison) && (comparison.ahead_by === 0)
}

/**
 * Indicates whether the base of the comparison can be
 * fast-forwarded to the provided HEAD.
 *
 * @param  {Object} comparison a github branch comparison
 * @return {Boolean}  if it's fast-forwardable
 */
function isFastForward(comparison) {
  return !requiresMergeCommit(comparison) && (comparison.ahead_by > 0)
}

/**
 * Indicates whether merging the branches included in the
 * comparison would require a merge commit. If `false`,
 * this indicates either the merge would be a fast-forward,
 * or the trees being compared are the same SHA.
 *
 * @param  {Object} comparison a github branch comparison
 * @return {Boolean}  if merging requires a merge commit
 */
function requiresMergeCommit(comparison) {
  return 0 !== comparison.behind_by
}
