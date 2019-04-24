/* Modules*/
const config = require('dos-config')
const log = require('debug')('astrotrain-manager:webhooks:backmerge')

/* API's */
const ghApi = require('../../../apis/github')

/* Constants */
const STATUS_CODES = require('../../../constants/http-status-codes')
const { PULL_REQUEST_STATUS, PULL_REQUEST_LABELS } = require('./constants')
const DEVELOPMENT = config.env === 'development'
const PLATFORM_REPO = config.platform.repo

/* Helpers */
const getGithubInstance = require('../../../helpers/github')

/* Notifications */
const {
  buildBackmergeFailureNotification,
  buildBackmergeSuccessNotification,
} = require('./notifications')

/**
 * Updates the provided repos `base` branch with the `head`'s HEAD
 * and updates the platform release manifest file with the
 * appropriate metadata
 * @param  {Array}   repos                platform component repos
 * @param  {String}  options.base         branch to update to
 * @param  {String}  options.head         branch to update from
 * @param  {Boolean} options.overwrite    overwrite existing PR
 */
module.exports = async function backmergeManager(payload) {

  const manager = backmergeManager.name

  const {
    commits,
    head_commit,
    ref,
    repository,
    installation,
  } = payload

  const head = ghApi.getBranchFromRef(ref)
  const repo = repository.name

  if (
    PLATFORM_REPO === repo ||
    !requiresBackmerge(head) ||
    !(head_commit && commits.length)
  ) {
    return { code: STATUS_CODES.ACCEPTED, manager }
  }

  const back = getBackmergeBranch(head)
  const owner = repository.owner.login
  const repos = DEVELOPMENT ? ['release-train-testing'] : [repo]

  log(`Manager ${manager} was summoned!`)

  try {

    const github = await getGithubInstance(installation.id)

    // get head and back refs for repo
    const refs = await Promise.all(repos.map(async repo => {
      const { data: headRef } = await github.git.getRef({
        owner,
        ref: `heads/${head}`,
        repo
      })

      const { data: backRef } = await github.git.getRef({
        owner,
        ref: `heads/${back}`,
        repo
      })

      return { repo, head: headRef, back: backRef }
    }))

    // filter out those repos that shouldn't be backmerged
    const backmergeables = refs.filter(r => r.head.object.sha !== r.back.object.sha)

    if (!backmergeables.length) {
      return { code: STATUS_CODES.ACCEPTED, manager }
    }

    const mergeResults = await getMergeResults({
      back,
      backmergeables,
      commits,
      github,
      head,
      owner,
    })

    // Response codes based on offical docs
    // See: https://developer.github.com/v3/repos/merging/
    //
    // 201: merge performed
    // 204: base already contains the head, nothing to merge
    // 404: Missing head or base
    // 409: Merge conflict
    const merges = mergeResults.filter(m => 201 === m.code)
    const ignored = mergeResults.filter(m => 204 === m.code)
    const failures = mergeResults.filter(m => 404 === m.code)
    const conflicts = mergeResults.filter(m => 409 === m.code)

    const conflictRefs = conflicts.map(c => refs.find(r => r.repo === c.repo))

    const conflictPrs = await handleMergeConflicts(conflictRefs)

    if (merges.length) log(`Merged ${merges.length} repos`)
    if (ignored.length) log(`Ignored ${ignored.length} repos`)
    if (failures.length) log(`Failed ${failures.length} merges`)
    if (conflictPrs.length) log(`Addressed ${conflictPrs.length} conflicts`)

    const notifications = buildBackmergeSuccessNotification({
      back,
      head,
      conflictPrs,
      failures,
      merges,
      owner,
    })

    return { code: STATUS_CODES.OK, manager, notifications }
  } catch (error) {
    /* eslint-disable */
    log(`
      Error performing backmerge from "${head}" to "${back}" on repo "${repo}" for "${owner}"'s installation in method ${manager}.
      Fix the error and retrigger the Github Webhook!
      ${error}`)
    /* eslint-enable */

    const notifications = buildBackmergeFailureNotification({
      back,
      head,
      error,
      repo: repos[0]
    })

    return { code: STATUS_CODES.BAD_REQUEST, manager, notifications }
  }
}

function requiresBackmerge(branch = '') {
  return !!getBackmergeBranch(branch)
}

function getBackmergeBranch(branch = '') {
  return config.platform.backmerge[branch]
}

function getBackmergeCommitMessage(head, sha, commits) {
  let message = `Merge ${head} fix (${ghApi.getShortSha(sha)})\n`

  commits.forEach(c => message += `* ${c.message} (${ghApi.getShortSha(c.id)})`)

  return message
}

async function getMergeResults({
  back,
  backmergeables,
  commits,
  github,
  head,
  owner,
}) {
  return await Promise.all(backmergeables.map(async r => {
    log(`Backmerging '${head}' into '${back}' in repo '${r.repo}'`)

    const sha = r.head.object.sha
    let result = {}

    try {
      const { data, status } = await github.repos.merge({
        base: back,
        commit_message: getBackmergeCommitMessage(head, sha, commits),
        head,
        owner,
        repo: r.repo,
        sha
      })

      const code = status

      result = { data, repo: r.repo, code, ...result, back, sha }

    } catch (err) {
      log(`Failed to backmerge '${head}' into '${back}' in repo '${r.repo}' -
 Error: ${err.message}
 ${err.stack}`)
      result = { err, repo: r.repo, code: err.code, ...result }
    }

    return result
  }))
}

async function handleMergeConflicts({
  github,
  conflicts = [],
  owner,
}) {
  if (!conflicts.length) return []

  const now = new Date()

  const prs = await Promise.all(conflicts.map(async c => {
    const headBranchName = ghApi.getBranchFromRef(c.head.ref)
    const backBranchName = ghApi.getBranchFromRef(c.back.ref)

    let pr = {}

    try {
      const resolutionBranch = await createOrUpdateConflictResolutionBranch({
        github,
        conflict: c,
        owner,
      })

      const { user } = (await github.pulls.list({
        owner,
        repo: c.repo,
        head: `${owner}:${headBranchName}`,
        state: PULL_REQUEST_STATUS.OPEN,
      })).data[0] || {}

      const { data, status } = await github.pulls.create({
        base: backBranchName,
        body: getConflictPrBody(
          headBranchName,
          backBranchName,
          user,
          resolutionBranch
        ),
        head: resolutionBranch.name,
        owner,
        repo: c.repo,
        title: getResolutionPrTitle(now)
      })

      const code = status

      log(`Created backmerge conflict resolution PR: ${data.html_url}`)

      pr = { data, repo: c.repo, code, ...pr }

    } catch (err) {
      log(`Failed to handle merge conflicts: ${err}`)
      pr = { err, repo: c.repo, code: err.code, ...pr }
    }

    try {
      // Add labels if PR was successfully created
      if (!pr.err) {
        const fixLabel = backBranchName === config.branch.beta ?
          [PULL_REQUEST_LABELS.BETA_FIX] : []
        const conflictPrLabels = [
          ...(fixLabel),
          PULL_REQUEST_LABELS.BACKMERGE_CONFLICT
        ]

        await github.issues.addLabels({
          owner,
          repo: pr.repo,
          number: pr.data.number,
          labels: conflictPrLabels
        })
      }
    } catch (err) {
      log(`Failed to add labels to conflict PR: ${err}`)
    }

    return pr
  }))

  return prs
}

async function createOrUpdateConflictResolutionBranch({
  github,
  conflict,
  owner,
}) {
  const branchName = getConflictBranchName(conflict)
  const repo = conflict.repo

  const branch = { name: branchName }

  try {
    const { data } = await github.git.createRef({
      owner,
      ref: `refs/heads/${branchName}`,
      repo,
      sha: conflict.head.object.sha
    })

    return { data, ...branch }
  } catch (err) {
    if (422 === err.code) {
      // Branch already exists; force-update head ref
      const { data } = await github.git.updateRef({
        force: true,
        owner,
        ref: `heads/${branchName}`,
        repo,
        sha: conflict.head.object.sha
      })

      return { data, ...branch }
    }

    log(`Failed to create branch '${branchName}' in '${repo}'`)

    // Any other error should bubble
    throw err
  }
}

function getConflictBranchName(conflict) {
  const headShortSha = getShortSha(conflict.head.object.sha)
  const backShortSha = getShortSha(conflict.back.object.sha)
  const prefix = `${ghApi.getBranchFromRef(conflict.back.ref)}-fix`

  return `${prefix}/conflict-${headShortSha}-${backShortSha}`
}

function getShortSha(commit = '') {
  if ('string' !== typeof commit) return getShortSha(commit.sha)

  return commit.substring(0, 7)
}

function getConflictPrBody(head, back, user, resolutionBranch) {
  return `Unable to automatically merge '${head}' into '${back}' due to merge conflicts.

${getAuthorForPrBody(user)} please fix conflicts and merge this PR into ${back}

# Merge instructions
## Always use MERGE and do not SQUASH nor REBASE :point-down:
\`\`\`bash
git fetch
git checkout ${resolutionBranch.name}
git merge origin/${back}
\`\`\`

**Actually fix the conflict**
\`\`\`bash
git commit
git push origin HEAD
\`\`\`

**Do not squash/rebase your commits.**
`
}

function getResolutionPrTitle(now) {
  now = now || new Date()

  const year = now.getUTCFullYear()
  const month = `0${now.getUTCMonth() + 1}`.slice(-2)
  const date = `0${now.getUTCDate()}`.slice(-2)

  return `Backmerge conflict ${year}-${month}-${date}`
}

function getAuthorForPrBody(user) {
  return (user && user.login) ? `@${user.login}` : 'Hey';
}