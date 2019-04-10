const Joi = require('joi');

const opts = require('../options')

const schema = Joi.object().keys({
  action: Joi.string(),
  pull_request: Joi.object().keys({
    head: Joi.object().keys({
      ref: Joi.string(),
      sha: Joi.string(),
    }),
    base: Joi.object().keys({
      ref: Joi.string(),
    }),
    merged: Joi.boolean(),
  }),
  repository: Joi.object().keys({
    name: Joi.string(),
    owner: Joi.object().keys({
      login: Joi.string(),
    }),
  }),
  installation: Joi.object().keys({
    id: Joi.number(),
  }),
});

module.exports = function pullRequest(obj) {
  return Joi.validate(obj, schema, opts)
}