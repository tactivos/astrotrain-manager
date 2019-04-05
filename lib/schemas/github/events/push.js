const Joi = require('joi');

const schema = Joi.object().keys({
  ref: Joi.string(),
  repository: Joi.object().keys({
    name: Joi.string(),
  }),
  sender: Joi.object().keys({
    login: Joi.string(),
  }),
});

const opts = {
  presence: 'required',
  allowUnknown: true
};

module.exports = function pushSchema(obj) { return Joi.validate(obj, schema, opts) }
