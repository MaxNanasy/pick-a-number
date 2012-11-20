#!/usr/bin/env node

var
  Cookies = require('cookies'),
  formidable = require('formidable'),
  fs = require('fs'),
  http = require('http'),
  httpStatus = require('http-status'),
  jsontemplate = require('json-template-foo'),
  openid = require('openid'),
  url = require('url'),
  uuid = require('node-uuid');

var
  idToGameMap = {},
  idToSessionMap = {};

function validateAndParseDecimalNonNegativeInt(string) {
  return string != null && string.match(/^\d+$/) ? parseInt(string, 10) : NaN;
}

http.ServerResponse.prototype.writeOnlyHead = function () {
  this.writeHead.apply(this, arguments);
  this.end();
};

http.createServer(function (request, response) {
  var
    cookies = new Cookies(request, response),
    game,
    gameId,
    gamePathParse,
    makeGuessPathParse,
    urlParse = url.parse(request.url, true);
  var
    sessionId = cookies.get('sessionId'),
    session = idToSessionMap.hasOwnProperty(sessionId) && idToSessionMap[sessionId];
  switch (urlParse.pathname) {
    case '/':
      response.writeOnlyHead(httpStatus.FOUND, { 'Location': 'game/' });
    break;
    case '/game/': // TODO: Handle URI-encoded versions
      switch (request.method) {
        case 'GET':
          response.end(jsontemplate.Template(fs.readFileSync('game.html.jsont', 'UTF-8'), { default_formatter: 'html' }).expand({ session: session })); // TODO: Content-Type
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
    case '/login/':
      function makeOpenIdRelyingParty() {
        return new openid.RelyingParty(
          (request.connection.encrypted ? 'https' : 'http') + '://' + request.headers.host + '/login/verify/'
        );
      }
      switch (request.method) {
        case 'GET':
          fs.createReadStream('login.html').pipe(response); // TODO: Content-Type
        break;
        case 'POST':
          new formidable.IncomingForm().parse(request, function (error, fields) {
            if (error) {
              response.writeHead(httpStatus.BAD_REQUEST); // TODO: Content-Type
              response.end(error); // TODO: Test
              return;
            }
            if (!fields.openIdIdentifier) {
              response.writeOnlyHead(httpStatus.BAD_REQUEST);
              return;
            }
            makeOpenIdRelyingParty().authenticate(fields.openIdIdentifier, false, function (error, authUrl) {
                if (error)
                  // TODO: Return to login page
                  // TODO: Content-Type
                  response.end('Authentication failed: ' + error.message);
                else if (!authUrl)
                  // TODO: Return to login page
                  // TODO: Content-Type
                  response.end('Authentication failed');
                else
                  response.writeOnlyHead(httpStatus.SEE_OTHER, { 'Location': authUrl });
              });
          });
        break;
        default:
          response.writeOnlyHead(httpStatus.METHOD_NOT_ALLOWED);
      }
    break;
    case '/login/verify/':
      if (request.method !== 'GET') {
        response.writeOnlyHead(httpStatus.METHOD_NOT_ALLOWED);
        return;
      }
      makeOpenIdRelyingParty().verifyAssertion(request, function (error, result) {
        if (!error && result.authenticated) {
          var
            sessionId = uuid.v4(),
            session = { openId: result.claimedIdentifier };
          // FIXME: Sessions are never removed from memory
          // TODO: Handle the case in which the user is already logged in
          idToSessionMap[sessionId] = session;
          cookies.set('sessionId', sessionId);
          response.writeOnlyHead(httpStatus.SEE_OTHER, { 'Location': '/' });
        }
        else {
          // TODO: Report errors to user
          error && console.log('OpenID error:', error.message);
          result && console.log('OpenID failure result:', result);
          response.writeOnlyHead(httpStatus.SEE_OTHER, { 'Location': '..' });
        }
      });
    break;
    case '/logout/':
      if (request.method !== 'POST') {
        response.writeOnlyHead(httpStatus.METHOD_NOT_ALLOWED);
        return;
      }
      if (session) {
        delete idToSessionMap[sessionId];
        cookies.set('sessionId');
      }
      response.writeOnlyHead(httpStatus.SEE_OTHER, { 'Location': '/' });
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
