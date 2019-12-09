const
  doAsync = require('doasync'),
  httpStatus = require('http-status'),
  openid = require('openid'),
  uuid = require('uuid')

const idToSessionMap = {}

function makeOpenIdRelyingParty(request) {
  const verifyUrl = `${request.protocol}://${request.hostname}/login/verify/`
  return new openid.RelyingParty(verifyUrl)
}

module.exports = function (app) {

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

}
