const
  slashes = require('connect-slashes'),
  cookieParser = require('cookie-parser'),
  express = require('express'),
  expressHealthcheck = require('express-healthcheck')

require('express-async-errors')

module.exports = function ({ app }) {
  app.use(cookieParser())
  app.use(express.urlencoded({
    extended: true
  }))
  app.use('/health', expressHealthcheck())
  app.use(slashes())
}
