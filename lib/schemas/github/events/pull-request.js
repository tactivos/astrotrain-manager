const Joi = require('joi');

const schema = Joi.object().keys({
  action: Joi.string(),
  pull_request: Joi.object().keys({
    head: Joi.object().keys({
      ref: Joi.string(),
      sha: Joi.string(),
      repo: Joi.object().keys({
        name: Joi.string(),
      }),
    }),
    base: Joi.object().keys({
      ref: Joi.string(),
    }),
    merged: Joi.boolean(),
  }),
  installation: Joi.object().keys({
    id: Joi.number(),
  }),
});

const opts = {
  presence: 'required',
  allowUnknown: true
};

module.exports = function pullRequest(obj) {
  return Joi.validate(obj, schema, opts)
}