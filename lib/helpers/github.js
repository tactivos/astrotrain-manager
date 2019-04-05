const config = require('dos-config')
const fs = require('fs')
const githubApp = require('@octokit/app')
const githubRest = require('@octokit/rest')
const path = require('path')

const root = path.dirname(require.main.filename)
const keyPath = `${root}/${config.github.privateKeyPath}`

async function getGithubInstance(installationId) {
  return new githubRest({
    async auth() {
      const installationAccessToken = await app.getInstallationAccessToken({
        installationId
      });
      return `token ${installationAccessToken}`;
    }
  })
}

const app = new githubApp({
  id: config.github.appId,
  privateKey: fs.readFileSync(keyPath, 'utf-8').toString()
})

module.exports = getGithubInstance