const serveStatic = require('serve-static');
const { JSDOM } = require('jsdom');
const kueUiClient = require('kue-ui-client');
const auth = require('http-auth')
const config = require('dos-config');

const basic = auth.basic({
  realm: 'shipit'
}, (user, password, cb) => {
  cb(user === config.shipit.auth.username && password === config.shipit.auth.password)
});

const indexFile = kueUiClient.getIndexFile();

function mountKueUi(app, kue, route, apiURL) {
  app.use(serveStatic(kueUiClient.getDistPath(), {
    index: false,
  }));

  app.get(`${route}/*`, auth.connect(basic), (req, res) => {
    const document = new JSDOM(indexFile);
    const { window } = document;

    const scriptEl = window.document.createElement('script');
    scriptEl.text =
      `window.__kueUiExpress = {
        rootUrl: "${route}",
        apiURL: "${apiURL || '/kue-api'}"
      };`;

    window.document.body.appendChild(scriptEl);

    res.send(window.document.documentElement.outerHTML);
  });

  app.use(apiURL, kue.app);
}

module.exports = mountKueUi;
