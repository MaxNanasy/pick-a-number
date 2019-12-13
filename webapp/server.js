#!/usr/bin/env node

const
  express = require('express'),
  fs = require('fs'),
  { MongoClient } = require('mongodb')

async function main() {

  const app = express()

  const dbUrl = process.env.DB_URL || 'mongodb://104.155.135.46:27017/pick-a-number'
  console.log(`${new Date()} Connecting to DB at ${dbUrl}`)
  const mongoClient = await MongoClient.connect(dbUrl, {
    useUnifiedTopology: true
  })
  console.log(`${new Date()} Connected to DB`)
  const db = mongoClient.db()

  const context = { app, db }
  require('./middleware')(context)
  fs.readdirSync('routes').forEach(function (filename) {
    require(`./routes/${filename}`)(context)
  })

  app.listen(8080, function () {
    console.log(`${new Date()} Listening on port 8080`)
  })

}

(async function() {
  try {
    await main()
  } catch (e) {
    console.log(`${new Date()} Error during startup:`, e)
    process.exit(1)
  }
})()
