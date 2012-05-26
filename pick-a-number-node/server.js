#!/usr/bin/env node

var
  formidable = require('formidable'),
  fs = require('fs'),
  http = require('http'),
  httpStatus = require('http-status'),
  jsontemplate = require('json-template-foo'),
  url = require('url'),
  uuid = require('node-uuid');

var idToGameMap = {};

function validateAndParseDecimalNonNegativeInt(string) {
  return string != null && string.match(/^\d+$/) ? parseInt(string) : NaN;
}

http.ServerResponse.prototype.writeOnlyHead = function () {
  this.writeHead.apply(this, arguments);
  this.end();
};

http.createServer(function (request, response) {
  var
    game,
    gameId,
    gamePathParse,
    makeGuessPathParse,
    urlParse = url.parse(request.url, true);
  switch (urlParse.pathname) {
    case '/':
      response.writeOnlyHead(httpStatus.FOUND, { 'Location': 'game/' });
    break;
    case '/game/': // TODO: Handle URI-encoded versions
      switch (request.method) {
        case 'GET':
          fs.createReadStream('game.html').pipe(response); // TODO: Content-Type
        break;
        case 'POST':
          gameId = uuid.v4();
          game = idToGameMap[gameId] = {
            number: Math.floor(Math.random() * 10),
            guesses: []
          };
          Object.defineProperty(game, 'state', { get: function () {
            return this.guesses[this.guesses.length - 1] === this.number ? 'won' : 'inProgress';
          } });
          response.writeOnlyHead(httpStatus.SEE_OTHER, { 'Location': encodeURIComponent(gameId) + '/' });
        break;
        default:
          response.writeOnlyHead(httpStatus.METHOD_NOT_ALLOWED);
      }
    break;
    case '/app-icon.svg':
      if (request.method !== 'GET') {
        response.writeOnlyHead(httpStatus.METHOD_NOT_ALLOWED);
        return;
      }
      response.writeHead(httpStatus.OK, { 'Content-Type': 'image/svg+xml', 'Content-Encoding': 'UTF-8' });
      fs.createReadStream('app-icon.svg').pipe(response);
    break;
    default: {
      if (gamePathParse = /^\/game\/([^\/]+)\/$/.exec(urlParse.pathname)) {
        if (request.method !== 'GET') {
          response.writeOnlyHead(httpStatus.METHOD_NOT_ALLOWED);
          return;
        }
        var uriEncodedGameId = gamePathParse[1];
        try {
          gameId = decodeURIComponent(uriEncodedGameId);
        } catch (e) {
          if (e instanceof URIError) {
            response.writeOnlyHead(httpStatus.BAD_REQUEST);
            return;
          } else {
            throw e;
          }
        }
        if (!idToGameMap.hasOwnProperty(gameId)) {
          response.writeOnlyHead(httpStatus.NOT_FOUND);
          return;
        }
        game = idToGameMap[gameId];
        switch (game.state) {
          case 'inProgress':
            response.end(jsontemplate.Template(fs.readFileSync('game-round.html.jsont', 'UTF-8'), { default_formatter: 'html' }).expand({ guesses: game.guesses })); // TODO: Content-Type
          break;
          case 'won':
            response.end(jsontemplate.Template(fs.readFileSync('game-won.html.jsont', 'UTF-8'), { default_formatter: 'html' }).expand({ guessesCount: game.guesses.length })); // TODO: Content-Type
          break;
        }
      } else if (makeGuessPathParse = /^\/game\/([^\/]+)\/guess\/$/.exec(urlParse.pathname)) {
        if (request.method !== 'POST') {
          response.writeOnlyHead(httpStatus.METHOD_NOT_ALLOWED);
          return;
        }
        new formidable.IncomingForm().parse(request, function (error, fields) {
          var game, gameId, guess, uriEncodedGameId;
          if (error) {
            response.writeHead(httpStatus.BAD_REQUEST); // TODO: Content-Type
            response.end(error); // TODO: Test
            return;
          }
          var guess = validateAndParseDecimalNonNegativeInt(fields.guess);
          if (!(guess >= 0 && guess < 10)) {
            response.writeOnlyHead(httpStatus.BAD_REQUEST); // TODO: Render error message
            return;
          }
          var gameId, uriEncodedGameId = makeGuessPathParse[1];
          try {
            gameId = decodeURIComponent(uriEncodedGameId);
          } catch (e) {
            if (e instanceof URIError) {
              response.writeOnlyHead(httpStatus.BAD_REQUEST);
              return;
            } else {
              throw e;
            }
          }
          if (!idToGameMap.hasOwnProperty(gameId)) {
            response.writeOnlyHead(httpStatus.NOT_FOUND);
            return;
          }
          game = idToGameMap[gameId];
          switch (game.state) {
            case 'inProgress':
              game.guesses.push(guess);
              response.writeOnlyHead(httpStatus.SEE_OTHER, { 'Location': '..' });
            break;
            case 'won':
              response.writeOnlyHead(httpStatus.CONFLICT); // TODO: Render error message
            break;
          }
        });
      } else response.writeOnlyHead(httpStatus.NOT_FOUND);
    }
  }
}).listen(8080);
