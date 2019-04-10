const Joi = require('joi');

const opts = require('../options')

const schema = Joi.object().keys({
  ref: Joi.string(),
  repository: Joi.object().keys({
    name: Joi.string(),
  }),
  sender: Joi.object().keys({
    login: Joi.string(),
  }),
});

module.exports = function pushSchema(obj) { return Joi.validate(obj, schema, opts) }
