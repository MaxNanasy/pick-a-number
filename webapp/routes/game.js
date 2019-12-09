const
  doAsync = require('doasync'),
  fs = require('fs'),
  httpStatus = require('http-status'),
  jsontemplate = require('json-template-foo'),
  uuid = require('uuid')

const idToGameMap = {}

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

function validateAndParseDecimalNonNegativeInt(string) {
  return string != null && string.match(/^\d+$/)
    ? parseInt(string, 10)
    : NaN
}

module.exports = function (app) {

  app.get('/', async function (request, response) {
    response.redirect('game/')
  })

  app.get('/game', async function (request, response) {
    const
      sessionId = request.cookies.sessionId,
      session = sessionId
        // FIXME idToSessionMap is only visible in auth.js
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

}
