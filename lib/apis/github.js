const config = require('dos-config')

const MANIFEST_FILE = config.platform.manifest
const PLATFORM_REPO = config.platform.repo
const REF_PREFIX = 'refs/heads/'

module.exports.listRepos = async function listRepos(github, { perPage }) {
  const response = await github.apps.listRepos({ per_page: perPage })
  return response.data.repositories
}

module.exports.getPlatformPR = async function getPlatformPR({
  github,
  base,
  owner,
}) {

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

/**
 * Get's current platform repo manifest file
 * @return {Object} the manifest file
 */
module.exports.getCurrentManifest = async function getCurrentManifest({ github, owner }) {
  const { data } = await github.repos.getContents({
    owner,
    repo: PLATFORM_REPO,
    path: MANIFEST_FILE,
    ref: config.platform.branch.beta
  })
  const file = Buffer.from(data.content, 'base64').toString()
  return JSON.parse(file)
}

/**
 * Returns the current manifest file
 *
 * @param  {Object} comparison a github branch comparison
 * @return {Object} current manifest file description
 */
module.exports.generateCurrentManifest = function generateCurrentManifest(comparisons) {
  return comparisons.reduce((obj, c) => ({
    ...obj,
    [c.repo]: module.exports.getShaFromComparison(c.data),
  }), {})
}

/**
 * Returns the comparison commit's SHA by searching
 * on the comparison itself based on a prioritised key criteria.
 *
 * @param  {Object} comparison a github branch comparison
 * @return {String}  commit SHA
 */
module.exports.getShaFromComparison = function getShaFromComparison({
  base_commit,
  commits,
  merge_base_commit
}) {
  if (commits.length) return commits[commits.length - 1].sha
  if (merge_base_commit) return merge_base_commit.sha
  return base_commit.sha
}

/**
 * Get's comparisons between two branches in X repos
 * @param  {Object} github GH API instance
 * @param  {String} base base ref for the comparison
 * @param  {String} head head ref for the comparison
 * @param  {Array} repos to make the comparison on
 * @return {Object} the GH payload for all the comparisons
 */
module.exports.getComparisons = async function getComparisons({
  github,
  base,
  head,
  owner,
  repos
}) {
  return Promise.all(repos.map(async repo => {
    const { data } = await github.repos.compareCommits({
      base,
      head,
      owner,
      repo
    })

    return { data, repo }
  }))
}

/**
 * Creates a plafrorm update PR
 * @param  {String} base base ref for the PR
 * @param  {String} head head ref for the PR
 * @return {[type]}      the PR
 */
module.exports.createPlatformUpdatePr = async function createPlatformUpdatePr({
  github,
  base = config.platform.branch.stable,
  head = config.platform.branch.beta,
  owner,
} = {}) {
  const { data } = await github.pullRequests.create({
    base,
    head,
    owner,
    repo: PLATFORM_REPO,
    title: `Release to ${base}`
  })

  return data
}

/**
 * Updates the manifest file in the platform release repo with
 * the current state of the `beta` branch in all platform repos
 * @param  {[String]} repos    array of platform repo names
 * @param  {String} branch name of the branch to update
 * @return {Object} GitHub's result of the manifest update
 */
module.exports.updateManifest = async function updateManifest({
  github,
  manifest = {},
  owner,
  updates = [],
  branch = config.platform.branch.beta
}) {

  if (!Array.isArray(updates)) updates = [updates]

  // update current manifest file with updated repos
  const newManifest = updates.reduce((manifest, u) => ({
    ...manifest,
    [u.repo]: u.sha,
  }), { ...manifest })

  // get base current tree
  const { data: tree } = await github.git.getTree({
    owner,
    repo: PLATFORM_REPO,
    tree_sha: branch
  })

  // creates a tree and a blob with the given content
  const { data: updatedTree } = await github.git.createTree({
    base_tree: tree.sha,
    owner,
    repo: PLATFORM_REPO,
    tree: [{
      content: `${JSON.stringify(newManifest, null, 2)}\n`,
      mode: '100644',
      path: MANIFEST_FILE,
      type: 'blob'
    }]
  })

  // create a commit in platform repo
  const { data: commit } = await github.git.createCommit({
    // TODO: use a better commit message
    message: 'Update manifest',
    owner,
    parents: [tree.sha],
    repo: PLATFORM_REPO,
    tree: updatedTree.sha
  })

  const { data: updatedRef } = await github.git.updateRef({
    owner,
    ref: `heads/${branch}`,
    repo: PLATFORM_REPO,
    sha: commit.sha
  })

  return updatedRef
}

/**
 * Gets the short SHA of a commit or a commit SHA
 * @param  {String|Object} commit either a github commit object or a commit SHA
 * @return {String}        the first 7 characters of the parameter's commit SHA
 */
module.exports.getShortSha = function getShortSha(commit = '') {
  if ('string' !== typeof commit) return getShortSha(commit.sha)

  return commit.substring(0, 7)
}

/**
 * Returns the branch name of a fully qualified git ref
 * E.g.: 'refs/heads/add/feature' -> 'add/feature'
 * @param  {String} ref fully qualified git ref
 * @return {String}     the branch name
 * @throws {Error}      If provided string is not a git ref
 */
module.exports.getBranchFromRef = function getBranchFromRef(ref = '') {
  if (!ref.startsWith(REF_PREFIX)) {
    throw new Error(`'${ref}' is not a valid git ref`)
  }

  return ref.substring(REF_PREFIX.length)
}