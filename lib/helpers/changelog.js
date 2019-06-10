/* Modules */
const config = require('dos-config')
const ghApi = require('../apis/github')
const log = require('debug')('astrotrain-manager:helpers:changelog')
const { sortBy, groupBy } = require('lodash')
const PromiseAll = require('promises-all')

/* Constants */
const changelogFile = config.platform.changelog
const platformRepo = config.platform.repo

exports.update = async function update({
  github,
  owner,
  branch,
  manifest,
}) {

  let prs = await getPRsFromManifest({
    github,
    owner,
    manifest,
    branch,
  })

  // get current changelog file from repo
  const currentChangelog = await getCurrentChangelog({
    github,
    owner,
    file: changelogFile,
    branch,
    prs,
  })

  if (!prs.length && isValidChangelog(currentChangelog)) {
    prs = await getPRsBasedOnCurrentChangelog({
      github,
      owner,
      currentChangelog,
      prs,
    })
  }

  const { changelog, changelogUrl } = await updateChangelog({
    github,
    owner,
    prs,
    currentChangelog,
    branch,
  })

  log('Finished updating changelog!')

  return { changelog, prs, changelogUrl }
}

/**
 * Gets current changelog file in 'branch'
 * @param  {String} file      changelog file name
 * @param  {String} branch    name of the branch where to look for the changelog file
 * @return {String}           current changelog file contents
 */
async function getCurrentChangelog({
  github,
  owner,
  file = config.platform.changelog,
  branch = config.platform.branch.beta,
  prs = [],
}) {
  try {
    const changelog = await github.repos.getContents({
      owner,
      repo: platformRepo,
      path: file,
      ref: branch,
    })
    return Buffer.from(changelog.data.content, 'base64').toString()
  } catch (e) {
    log(`No "CHANGELOG.md" file found for ${branch}...creating one!`)
    const today = getFormattedDate()
    return buildChangelogSection(today, prs)
  }
}

/**
 * Gets a list of Github Pull Request based on manifest commit sha's
 * @param  {Object}     manifest    manifest-styled object ({ repo: commit-sha })
 * @param  {String}     branch      name of the branch where to look for the manifest file
 * @return {Collection}         list of Github Pull Requests
 */
async function getPRsFromManifest({
  github,
  owner,
  manifest,
  branch,
}) {
  manifest = manifest || (await ghApi.getCurrentManifest({ github, owner, branch }))

  const { commits, repos } = await getCommits({ github, owner, manifest })
  const prs = await getPRsFromCommits({ github, owner, commits, repos })

  return prs
}
/**
 * Get's a list of Pull Requests based on the difference between the ones
 * in the current changelog (latest changes) and the ones in the 'prs'
 * paramter (extracted from manifest file)
 * @param  {String}     changelog    a changelog in with proper formatting
 * @param  {Collection} prs          collection of Pull Requests
 * @return {Boolean}                 is changelog valid or not
 */
async function getPRsBasedOnCurrentChangelog({
  github,
  owner,
  currentChangelog = '',
  prs = [],
}) {
  const { newestChanges } = getLatestChangesBasedOnDate(currentChangelog)
  const regexExtractRepoAndPullRequestNumber = /(tactivos\/)(.*?)(\/pull)(\/[0-9]*)/gm

  const latestPullRequestPerRepo = newestChanges
    .match(regexExtractRepoAndPullRequestNumber)
    .reduce((acc, info) => convertToRepoToLatestPR(acc, info), {})

  const pullRequestDifferencePerRepo = getPullRequestsPerRepo(
    latestPullRequestPerRepo,
    prs,
    owner,
  )

  const getPRPromises = pullRequestDifferencePerRepo
    .map(difference => {
      const repo = Object.keys(difference)[0]
      const listOfPRNumbers = Object.values(difference)[0]
      return listOfPRNumbers.map(number => github.pulls.get({
        owner,
        repo,
        number
      }))
    })

  // flatten the array...
  const PRPromises = [].concat(...getPRPromises)

  if (!PRPromises.length) return []

  const results = await PromiseAll.all(PRPromises)
  const differencePRs = results.resolve
    .map(res => res.data)
    .filter(pr => pr.merged && pr.state === 'closed')

  log(`There were ${differencePRs.length} changes since last changelog update!`)

  return differencePRs
}

/**
 * Updates the changelog file in the platform release repo with
 * the current state of the `manifest` file in branch
 * @param  {Collection} prs            array of prs matching the commits in manifest file
 * @param  {String}     changelogFile  name of changelog file
 * @return {Object}                    new changelog file
 */
async function updateChangelog({
  github,
  owner,
  prs = [],
  currentChangelog = '',
  branch = config.platform.branch.beta
}) {

  if (!prs || (Array.isArray(prs) && !prs.length)) {
    return {
      changelog: currentChangelog,
      prs,
      changelogUrl: buildChangelogUrl(owner, branch),
    }
  }

  if (!Array.isArray(prs)) prs = [prs]

  prs = sortPRs(owner, prs)

  log(`Ready to update changelog with ${prs.length} new changes...`)

  const today = getFormattedDate()

  // build changelog message
  const newChangelog = buildChangelogContent(currentChangelog, prs, today)

  // get base current tree
  const { data: tree } = await github.git.getTree({
    owner,
    repo: platformRepo,
    tree_sha: branch
  })

  // creates a tree and a blob with the given content
  const { data: updatedTree } = await github.git.createTree({
    base_tree: tree.sha,
    owner,
    repo: platformRepo,
    tree: [{
      content: newChangelog,
      mode: '100644',
      path: changelogFile,
      type: 'blob'
    }]
  })

  // create a commit in platform repo
  const { data: commit } = await github.git.createCommit({
    message: `Update changelog`,
    owner,
    parents: [tree.sha],
    repo: platformRepo,
    tree: updatedTree.sha
  })

  const { data: updatedRef } = await github.git.updateRef({
    owner,
    ref: `heads/${branch}`,
    repo: platformRepo,
    sha: commit.sha
  })

  return {
    changelog: newChangelog,
    prs,
    updatedRef,
    changelogUrl: buildChangelogUrl(owner, branch),
  }
}

/**
 * Build Changelog URL from "owner" & "branch"
 * @param  {String} owner     Github's organization owner
 * @param  {String} branch    branch where the Changelog was updated
 * @return {String}           URL to the Changelog file
 */
function buildChangelogUrl(owner, branch) {
  return `https://github.com/${owner}/${platformRepo}/blob/${branch}/${changelogFile}`
}

/**
 * Gets Github's commits objects using commits in a manifest file
 * @param  {Collection} prs            array of prs matching the commits in manifest file
 * @param  {String}     changelogFile  name of changelog file
 * @return {Object}                    new changelog file
 */
async function getCommits({
  github,
  owner,
  manifest = {},
}) {
  const repos = Object.keys(manifest)

  const commitsPromises = repos.map(repo => github.repos.getCommit({
    owner,
    repo,
    sha: manifest[repo],
  }))

  const commits = (await Promise.all(commitsPromises)).map(result => result.data)

  return { commits, repos }
}

/**
 * Validates if the changelog provided as parameter is a valid one
 * @param  {String} changelog    a changelog in with proper formatting
 * @return {Boolean}             is changelog valid or not
 */
function isValidChangelog(changelog = '') {
  // extract changelog dates that maches 'January 8, 2019'
  const regexForExtractingChangelogDates = /(?!###\s)([a-zA-Z]*\s)(\d{1,2},\s)(\d{4})/gm

  return !!(
    changelog
    && changelog.length
    && Array.isArray(changelog.match(regexForExtractingChangelogDates))
  )
}

/**
 * Gets Github's PR objects using Github's commits objects
 * in case a PR is not found in the commit, it will search for it in
 * it's parents
 * @param  {Collection} commits    collection of Github's commits
 * @return {Collection}                list of Github's Pull Requests
 */
async function getPRsFromCommits({
  github,
  owner,
  commits = [],
}) {
  const commitSearchPromises = commits
    .map(commit => github.search.issuesAndPullRequests({
      q: commit.parents[commit.parents.length - 1].sha
    }))

  const commitSearch = (await Promise.all(commitSearchPromises))
    .map(result => result.data.items[0])

  const prs = commitSearch
    .filter(pr => pr && pr.repository_url)
    .map(pr => ({ ...pr, repo: stripRepoFromUrl(owner, pr.repository_url) }))
  const reposWithPR = prs.map(pr => stripRepoFromUrl(owner, pr.repository_url))
  const commitsWithNoPR = commits.filter(commit =>
    !reposWithPR.includes(stripRepoFromUrl(owner, commit.url)))

  const parentCommitManifest = getManifestFromParentsCommits(owner, commitsWithNoPR)
  const parentCommits = (await getCommits({
    github,
    owner,
    manifest: parentCommitManifest,
  })).commits

  if (!parentCommits[0] || !parentCommits[0].parents.length) {
    log(`No parents commits found!`)
    return prs
  }

  const parentCommitSearchPromises = parentCommits
    .map(commit => github.search.issuesAndPullRequests({
      q: commit.parents[commit.parents.length - 1].sha
    }))

  const parentCommitPRs = (await Promise.all(parentCommitSearchPromises))
    .map(result => result.data.items[0])
    .map(pr => ({ ...pr, repo: stripRepoFromUrl(owner, pr.repository_url) }))

  return prs.concat(parentCommitPRs)
}

/**
 * Get's latest changes based on today's date.
 * In case latest changes match today's date, it will look for the previous
 * changes to the latests ones
 * @param  {String} changelog    a changelog in with proper formatting
 * @return {Boolean}             is changelog valid or not
 */
function getLatestChangesBasedOnDate(changelog = '') {
  const today = getFormattedDate()
  const { newestChanges, oldestChanges } = splitNewestChangesFromOldest(changelog)
  const newestChangeWasToday = newestChanges.indexOf(today) !== -1

  if (changelog === newestChanges) return { newestChanges: '', oldestChanges: '' }
  if (!newestChangeWasToday) return { newestChanges, oldestChanges }
  if (!isValidChangelog(oldestChanges)) return { newestChanges, oldestChanges }

  const previousLatestChanges = splitNewestChangesFromOldest(oldestChanges)

  return previousLatestChanges
}

function convertToRepoToLatestPR(acc, info = '') {
  const [, repo, , number] = info.split('/')

  if (acc[repo]) return acc

  return {
    ...acc,
    [repo]: parseInt(number)
  }
}

/**
 * Get's the difference in PR's between the latest PR on current changelog 
 * and the one in current manifest file and returns the list of them
 * @param  {Object}     reposWithLatestPR    an object with { repo: #PRNumber } format
 * @param  {Collection} prs                  collection of Pull Requests
 * @return {Collection}                      list of repos with their Pull Requests number
 */
function getPullRequestsPerRepo(reposWithLatestPR = {}, prs = [], owner) {
  return Object.keys(reposWithLatestPR)
    .map(repo => {
      const number = reposWithLatestPR[repo]
      const pr = prs.find(pr => stripRepoFromUrl(owner, pr.html_url) === repo)

      const differenceBetweenPRNumbers = [...Array(pr.number - number).keys()]
      const PRNumberList = differenceBetweenPRNumbers.map(n => n + number + 1)

      return { [repo]: PRNumberList }
    })
}

/**
 * Builds the new changelog message in Markdown format!
 * @param  {String}     changelog    current changelog message
 * @param  {Collection} prs          array of prs matching the commits in manifest file
 * @param  {String}     today        today's date in 'January 8, 2019' format
 * @return {String}                  updated changelog message in Markdown format
 */
function buildChangelogContent(
  changelog = config.platform.changelog,
  prs = [],
  today = ''
) {
  const { newestChanges, oldestChanges } = getLatestChangesBasedOnDate(changelog)

  return `
${buildChangelogSection(today, prs)}
${newestChanges}
${oldestChanges}
`.trim()
}

/**
 * Builds a 'full day' of changes for the changelog
 * @param  {String}     today    today's date in 'January 8, 2019' format
 * @param  {Collection} prs      array of prs matching the commits in manifest file
 * @return {String}              'full day' of changes in Markdown format
 */
function buildChangelogSection(today = '', prs = []) {
  return `
### ${today}
${buildBulletChanges(prs)}
---
`.trim()
}

/**
 * Builds a bullet section for the changelog
 * @param  {Collection} prs    array of prs matching the commits in manifest file
 * @return {String}            bullet list in Markdown format
 */
function buildBulletChanges(prs = []) {
  const sortedByNumber = sortBy(prs, ['number']).reverse()
  const groupedByRepo = groupBy(sortedByNumber, 'repo')
  const sortedByRepo = Object.keys(groupedByRepo).sort()
    .reduce((acc, key) => ({ ...acc, [key]: groupedByRepo[key] }), {})

  const bullets = Object.keys(sortedByRepo)
    .map(repo => buildBulletBlock(repo, sortedByRepo[repo]))

  return bullets.join('')
}

/**
 * Builds a 'bullet block' for the changelog
 * @param  {String} repo    name of the repo we are building the bullets for
 * @param  {Array}  prs     array of prs matching the commits in manifest file
 * @return {String}         bullet line of changes in Markdown format
 */
function buildBulletBlock(repo = '', prs = []) {

  const changes = prs
    .map(pr => `  * ${buildBulletLine(pr)}`)
    .join('\n')

  return `
* **${repo}:**
${changes}
`.trim()
}

/**
 * Builds a bullet line for the changelog
 * @param  {Collection} prs    array of prs matching the commits in manifest file
 * @return {String}            bullet line in Markdown format
 */
function buildBulletLine(pr = {}) {
  const { user, html_url, number, title } = pr
  //eslint-disable-next-line max-len
  return `${title} ([@${user.login}](${user.html_url}) in [#${number}](${html_url}))`
}

/**
 * Adds a new key 'repo' to all PR's & sorts the collection by it
 * @param  {Collection} prs      Github PR's
 * @return {Collection}          Github PR's sorted by repo name
 */
function sortPRs(owner, prs = []) {
  const PRsWithRepo = prs.map(pr => ({
    ...pr,
    repo: stripRepoFromUrl(owner, pr.html_url),
  }))
  return sortBy(PRsWithRepo, pr => pr.repo)
}

/**
 * Builds an object in 'manifest' file format using 
 * the latest commit in the 'parents' key of a Github's commits object 
 * @param  {Collection} commits    collection of Github's commit objects
 * @return {Object}                manifest file based on 'parents' commits
 */
function getManifestFromParentsCommits(owner, commits = []) {
  return commits.reduce((obj, commit) => {
    const key = stripRepoFromUrl(owner, commit.url)
    return {
      ...obj,
      [key]: commit.parents[commit.parents.length - 1].sha,
    }
  },
    {})
}

/**
 * Get a date in 'January 8, 2019' format
 * @return {String}   formatted date
 */
function getFormattedDate() {
  const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  const today = new Date()
  const todayFormatted = today.toLocaleDateString("en-US", dateOptions)

  return todayFormatted
}

/**
 * Splits a changelog in two: latest changes |  all the other changes
 * and returns and object with them
 * @param  {String} changelog    a changelog in with proper formatting
 * @return {Object}              latest changes & all the remaining changes
 */
function splitNewestChangesFromOldest(changelog = '') {
  const dashes = '---'
  const indexOfFirstDashes = changelog.indexOf(dashes)
  const newestChanges = changelog.substring(0, indexOfFirstDashes + dashes.length).trim()
  const oldestChanges = changelog.substring(indexOfFirstDashes + dashes.length).trim()

  return { indexOfFirstDashes, newestChanges, oldestChanges }
}

/**
 * Gets a Github's repo name via some Github's URL (html_url, etc)
 * @param  {String} url    a Github's payload URL
 * @return {String}        name of a repo 
 */
function stripRepoFromUrl(owner, url = '') {
  const stripUntilOwner = url.split(`${owner}/`)
  return stripUntilOwner[1].split('/')[0]
}