/*
  We extend the req object with an 'tasker' key to manipulate
  through different middlewares without poluting the req object
*/
module.exports =  (req, res, next) => { req.tasker = req.tasker || {}; next() }
