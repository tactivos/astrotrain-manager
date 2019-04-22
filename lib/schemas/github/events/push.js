const Joi = require('joi');

const opts = require('../options')

const schema = Joi.object().keys({
  commits: Joi.array(),
  head_commit: Joi.object(),
  ref: Joi.string(),
  repository: Joi.object().keys({
    name: Joi.string(),
  }),
  sender: Joi.object().keys({
    login: Joi.string(),
  }),
  installation: Joi.object().keys({
    id: Joi.number(),
  }),
});

module.exports = function push(obj) {
  return Joi.validate(obj, schema, opts)
}
