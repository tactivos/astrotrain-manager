const Joi = require('joi');

const pull_request = Joi.object().keys({
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
});

const push = Joi.object().keys({
  ref: Joi.string(),
  repository: Joi.object().keys({
    name: Joi.string(),
  }),
  sender: Joi.object().keys({
    login: Joi.string(),
  }),
});

const schemas = [ pull_request, push ];

const opts = {
  presence: 'required',
  allowUnknown: true
};

const def = { error: 'No valid schema found' };

module.exports = obj => schemas
  .map(schema => Joi.validate(obj, schema, opts))
  .find(res => !res.error) || def
