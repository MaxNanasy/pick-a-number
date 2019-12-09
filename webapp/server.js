#!/usr/bin/env node

const
  express = require('express'),
  fs = require('fs')

const app = express()

require('./middleware')(app)
fs.readdirSync('routes').forEach(function (filename) {
  require(`./routes/${filename}`)(app)
})

app.listen(8080, function () {
  console.log(`${new Date()} Listening on port 8080`)
})
