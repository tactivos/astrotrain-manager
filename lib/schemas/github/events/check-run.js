const Joi = require('joi');

const opts = require('../options')

const schema = Joi.object().keys({
  action: Joi.string(),
  check_run: Joi.object().keys({
    pull_requests: Joi.array().items(
      Joi.object().keys({
        base: Joi.object().keys({
          ref: Joi.string(),
        }),
      }),
    ),
  }),
  repository: Joi.object().keys({
    name: Joi.string(),
    owner: Joi.object().keys({
      login: Joi.string(),
    }),
  }),
  requested_action: Joi.object().keys({
    identifier: Joi.string(),
  }).optional(),
  installation: Joi.object().keys({
    id: Joi.number(),
  }),
});

module.exports = function checkRun(obj) {
  return Joi.validate(obj, schema, opts)
}