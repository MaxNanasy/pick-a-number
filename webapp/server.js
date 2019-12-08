#!/usr/bin/env node

const
  slashes = require('connect-slashes'),
  cookieParser = require('cookie-parser'),
  doAsync = require('doasync'),
  express = require('express'),
  expressHealthcheck = require('express-healthcheck'),
  fs = require('fs'),
  httpStatus = require('http-status'),
  jsontemplate = require('json-template-foo'),
  openid = require('openid'),
  uuid = require('uuid')

require('express-async-errors')

const
  idToGameMap = {},
  idToSessionMap = {}

const app = express()

app.use(cookieParser())
app.use(express.urlencoded({
  extended: true
}))
app.use('/health', expressHealthcheck())
app.use(slashes())

function validateAndParseDecimalNonNegativeInt(string) {
  return string != null && string.match(/^\d+$/)
    ? parseInt(string, 10)
    : NaN
}

async function renderHtmlTemplate(response, templateFile, data) {
  const
    templateOptions = {
      default_formatter: 'html'
    },
    templateString =
      await doAsync(fs).readFile(templateFile, 'utf8'),
    htmlString = jsontemplate.expand(templateString, data, templateOptions)

  response
    .type('html')
    .send(htmlString)
}

app.get('/', async function (request, response) {
  response.redirect('game/')
})

app.get('/game', async function (request, response) {
  const
    sessionId = request.cookies.sessionId,
    session = sessionId
      && idToSessionMap.hasOwnProperty(sessionId)
      && idToSessionMap[sessionId]
      || null

  await renderHtmlTemplate(response, 'game.html.jsont', {
    openId: session && session.openId
  })
})

app.post('/game', async function (request, response) {
  const gameId = uuid.v4()
  idToGameMap[gameId] = {
    number: Math.floor(Math.random() * 10),
    guesses: [],
    get currentGuess() {
      return this.guesses.length
        ? this.guesses[this.guesses.length - 1]
        : null
    },
    get state() {
      return this.currentGuess === this.number ? 'won' : 'inProgress'
    }
  }
  response.redirect(httpStatus.SEE_OTHER, encodeURIComponent(gameId) + '/')
})

function makeOpenIdRelyingParty(request) {
  const verifyUrl = `${request.protocol}://${request.hostname}/login/verify/`
  return new openid.RelyingParty(verifyUrl)
}

app.get('/login', async function (request, response) {
  response.sendFile('login.html', {
    root: '.'
  })
})

app.post('/login', async function (request, response) {
  const openIdIdentifier = request.body.openIdIdentifier
  if (!openIdIdentifier) {
    response.sendStatus(httpStatus.BAD_REQUEST)
    return
  }

  const relyingParty = makeOpenIdRelyingParty(request)

  let authUrl, authError
  try {
    authUrl = await doAsync(relyingParty).authenticate(openIdIdentifier, false)
  } catch (e) {
    authError = e
  }
  if (!authUrl) {
    // TODO Return to login page
    // TODO Status code?
    const errorMessage = authError
      ? `Authentication failed: ${authError.message}`
      : 'Authentication failed'
    response
      .type('text')
      .send(errorMessage)
    return
  }

  response.redirect(httpStatus.SEE_OTHER, authUrl)
})

app.get('/login/verify', async function (request, response) {
  const relyingParty = makeOpenIdRelyingParty(request)

  let verificationResult, verificationError
  try {
    verificationResult = await doAsync(relyingParty).verifyAssertion(request)
  } catch (e) {
    verificationError = e
  }
  if (!verificationResult) {
    // TODO Report errors to user
    verificationError && console.log(`${new Date()} OpenID error: ${verificationError.message}`)
    response.redirect(httpStatus.SEE_OTHER, '..')
    return
  }

  const
    sessionId = uuid.v4(),
    session = {
      openId: result.claimedIdentifier
    }
  // FIXME Sessions are never removed from memory unless user logs out
  // TODO Handle the case in which the user is already logged in
  // TODO Report login success to user
  idToSessionMap[sessionId] = session

  response.cookie('sessionId', sessionId)
  response.redirect(httpStatus.SEE_OTHER, '/')
})

app.post('/logout', async function (request, response) {
  const sessionId = request.cookies.sessionId
  if (idToSessionMap.hasOwnProperty(sessionId)) {
    delete idToSessionMap[sessionId]
    response.clearCookie('sessionId')
  }
  // TODO Report logout success/failure to user
  response.redirect(httpStatus.SEE_OTHER, '/')
})

app.get('/game/:gameId', async function (request, response) {
  const gameId = request.params.gameId
  if (!idToGameMap.hasOwnProperty(gameId)) {
    // TODO HTML error page?
    response
      .status(httpStatus.NOT_FOUND)
      .type('text')
      .send(`No game found with ID ${gameId}`)
    return
  }

  const game = idToGameMap[gameId]
  switch (game.state) {
    case 'inProgress':
      await renderHtmlTemplate(response, 'game-round.html.jsont', game)
    break
    case 'won':
      await renderHtmlTemplate(response, 'game-won.html.jsont', {
        guessesCount: game.guesses.length
      })
    break
  }
})

app.post('/game/:gameId/guess', function (request, response) {
  const gameId = request.params.gameId
  if (!idToGameMap.hasOwnProperty(gameId)) {
    // TODO HTML error page?
    response
      .status(httpStatus.NOT_FOUND)
      .type('text')
      .send(`No game found with ID ${gameId}`)
    return
  }

  const guess = validateAndParseDecimalNonNegativeInt(request.body.guess)
  if (!(guess >= 0 && guess < 10)) {
    response.sendStatus(httpStatus.BAD_REQUEST) // TODO Render error message
    return
  }

  const game = idToGameMap[gameId]
  switch (game.state) {
    case 'inProgress':
      game.guesses.push(guess)
      response.redirect(httpStatus.SEE_OTHER, '..')
    break
    case 'won':
      response.sendStatus(httpStatus.CONFLICT) // TODO Render error message
    break
  }
})

app.listen(8080, function () {
  console.log(`${new Date()} Listening on port 8080`)
})
