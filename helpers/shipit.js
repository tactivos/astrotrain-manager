/* Modules */
const config = require('dos-config');
const shipit = require('@tactivos/shipit');

/* Constants */
const PR_CONDITIONS = require('../lib/constants/pull-request-conditions');

const opts = {
  ...config.shipit,
  github: {
    organization: config.github.organization,
    token: config.github.token,
    username: config.github.username,
  },
  notifications: true,
  queue: {
    alwaysRunHooks: true,
  },
};

const ORGANIZATION = opts.github.organization;

const VRTRepos = {
  murally: 'murally',
  muralApi: 'mural-api',
};
const VRTMessages = ['pending'];

const CONTEXT = {
  VISUAL_REGRESSION: 'visual-regression',
  BUILD: 'continuous-integration/jenkins/branch',
};

const runVRT = async ({ gh, prs }) => {
  /* We want to prioritize 'murally' build,
    that's why it's not a single 'find' operation
  */
  const murally = prs.find(p => VRTRepos.murally === p.head.repo.name);
  const muralApi = prs.find(p => VRTRepos.muralApi === p.head.repo.name);
  const VRTPullRequest = murally || muralApi;

  const baseIsMaster = prs[0].base.ref === 'master';

  if (VRTPullRequest) {

    let err;
    let results;

    try {
      results = await gh.pullRequests.get({
        number: VRTPullRequest.number,
        owner: ORGANIZATION,
        repo: VRTPullRequest.head.repo.name,
      });
    } catch (e) {
      err = e;
    }

    if (err) throw err;

    const pr = results.data;

    if (pr.state !== PR_CONDITIONS.STATUS_OPEN) return null;

    const ref = {
      owner: ORGANIZATION,
      repo: pr.base.repo.name,
      ref: pr.head.sha,
    };

    try {
      results = await gh.repos.getCombinedStatusForRef(ref);
    } catch (e) {
      err = e;
    }

    const { statuses } = results.data;
    const VRTCheck = statuses.find(s => s.context === CONTEXT.VISUAL_REGRESSION);
    const buildCheck = statuses.find(s => s.context === CONTEXT.BUILD);

    if (!VRTCheck && !baseIsMaster) {
      throw new Error('Couldn\'t find the visual-regressions status check!');
    }
    if (!buildCheck) throw new Error('Couldn\'t find the Jenkins build status check!');

    const VRTPending = VRTMessages.find(msg =>
      VRTCheck && VRTCheck.description.indexOf(msg) !== -1
    );
    const buildSuccess = buildCheck.state === 'success';

    if (!buildSuccess) return null;
    if (baseIsMaster) return null;
    if (!VRTPending) return null;

    const comment = {
      owner: ORGANIZATION,
      repo: pr.head.repo.name,
      number: pr.number,
      body: 'VRT',
    };

    try {
      results = await gh.issues.createComment(comment);
    } catch (e) {
      err = e;
    }

    if (err) throw err;

    return results;
  }

  return false;
};

const init = shipit({
  ...opts,
  events: {
    preStatusChecks: runVRT,
  },
});

module.exports = init;
