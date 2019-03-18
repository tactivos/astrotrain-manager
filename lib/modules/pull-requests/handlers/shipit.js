/* Modules */
const shipit = require('../../../../helpers/shipit');

/* Helpers */
const finder = require('../../../../helpers/recursive-collection-finder');

/* Constants */
const USERS = require('../../../constants/mural-users');

module.exports = async (req, res, next) => {

  const payload = req.body;

  if (!validComment(payload)) {
    res.status(200).send('Invalid GH comment for shipit!');
    return next();
  }

  shipit.api.pushIt(payload, {
    shipper: finder(payload.comment.user.login, USERS),
  });

  res.sendStatus(200);
  next();

}

const validComment = ({ comment }) => comment && comment.user && comment.user.login;
