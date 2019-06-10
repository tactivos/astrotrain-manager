/* Modules*/
const config = require('dos-config')
const log = require('debug')('astrotrain-manager:webhooks:manifest-update')

/* API's */
const ghApi = require('../../../apis/github')

/* Constants */
const SEMVER = require('../../../constants/semver')
const STATUS_CODES = require('../../../constants/http-status-codes')
const PLATFORM_REPO = config.platform.repo

/* Helpers */
const changelog = require('../../../helpers/changelog')
const getGithubInstance = require('../../../helpers/github')
const tag = require('../../../helpers/github-tag')

/* Notifications */
const {
  buildManifestUpdateFailureNotification,
  buildManifestUpdateSuccessNotification,
} = require('./notifications')

module.exports = async function manifestUpdateManager(payload) {

  const manager = manifestUpdateManager.name

  const {
    after,
    ref,
    installation,
    repository,
  } = payload

  const head = ghApi.getBranchFromRef(ref)
  const owner = repository.owner.login
  const repo = repository.name

  if (
    PLATFORM_REPO === repo ||
    !Object.values(config.platform.branch).includes(head)
  ) {
    return { code: STATUS_CODES.ACCEPTED, manager }
  }

  log(`Manager ${manager} was summoned!`)

  try {
    const github = await getGithubInstance(installation.id)

    log(`Updating manifest for ${repo} to ${after}`)

    const update = { repo, sha: after }

    const updatedRef = await ghApi.updateManifest({
      github,
      owner,
      updates: update,
      branch: head,
    })

    if (!Object.keys(updatedRef).length) {
      log(`Manifest for ${repo} is already updated, nothing was done!`)
      return { code: STATUS_CODES.ACCEPTED, manager }
    }

    log(`Finished manifest update for ${repo} to ${after}`)

    let pr

    if (head !== config.platform.branch.stable) {
      const base = ghApi.getNextBase(head)
      const existingPr = await ghApi.getPlatformPR({ github, base, head, owner })

      if (existingPr) {
        log(`Updating ${repository.name} pull request from ${head} to ${base}`)
      } else {
        log(`Creating ${repository.name} pull request from ${head} to ${base}`)
      }

      // finally, ensure a platform update PR exists
      pr = await (existingPr || ghApi.createPlatformUpdatePr({
        github,
        base,
        head,
        owner,
      }))

      log(`Pull request "${pr.title}" created/updated at ${pr.html_url}`)
    }

    const { changelogUrl } = await changelog.update({ github, owner, branch: head })
    log(`Updated changelog on ${head}, check it here ${changelogUrl}!`)

    const { version } = await tag.create({
      github,
      owner,
      branch: head,
      sha: updatedRef.object.sha,
      type: SEMVER.PATCH,
    })
    log(`Release succesfully tagged as v${version}`)

    const notifications = buildManifestUpdateSuccessNotification({
      head,
      repo,
      pr,
      changelogUrl,
    })

    return { code: STATUS_CODES.OK, manager, notifications }
  } catch (error) {
    /* eslint-disable */
    log(`
      Error updating manifest on "${head}" for "${repo}" for "${owner}"'s installation in method ${manager}.
      Fix the error and retrigger the Github Webhook!
      ${error}`)
    /* eslint-enable */

    const notifications = buildManifestUpdateFailureNotification({ head, repo, error })

    return { code: STATUS_CODES.BAD_REQUEST, manager, notifications }
  }
}
