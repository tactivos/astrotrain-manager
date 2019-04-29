/* Modules */
const config = require('dos-config')
const semver = require('semver')

/* Constants */
const SEMVER = require('../constants/semver')
const MIN_VERSION = '1.0.0'
const PLATFORM_REPO = config.platform.repo

exports.create = async function create({
  github,
  owner,
  branch,
  sha,
  type,
}) {

  if (!Object.values(SEMVER).includes(type)) {
    throw new Error(`No semver type found for "${type}"`)
  }

  // get current changelog file from repo
  const { data: tags } = await github.repos.listTags({
    owner,
    repo: PLATFORM_REPO,
  })

  const version = getValidTag(tags, branch, type)

  const { data: tag } = await github.git.createTag({
    owner,
    repo: PLATFORM_REPO,
    tag: version,
    message: `Release v${version}-${branch}`,
    object: sha,
    type: 'commit',
  })

  const { data: ref } = await github.git.createRef({
    owner,
    repo: PLATFORM_REPO,
    ref: `refs/tags/${tag.tag}`,
    sha: tag.sha,
  })

  return { tag, tags, tagRef: ref, version }
}

const getValidTag = (tags, branch, type) => {
  const versions = tags.map(tag => tag.name)
  const validTag = versions.find(version =>
    version.indexOf(branch) !== -1 && semver.valid(version)
  )

  if (!validTag) return `${MIN_VERSION}-${branch}`

  const versionWithoutBranch = validTag.split(`-${branch}`)[0]
  return `${semver.inc(versionWithoutBranch, type)}-${branch}`
}