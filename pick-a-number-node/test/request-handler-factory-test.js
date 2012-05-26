#!/usr/bin/env node

var
  assert = require('assert'),
  httpStatus = require('http-status'),
  requestHandlerFactory = require('injectr')('./request-handler-factory.js');

require('vows').describe('Server').addBatch({
  'A request handler': {
    topic: requestHandlerFactory(),
    'when invoked with the pathname "/"': {
      topic: function (handleRequest) {
        handleRequest({
          pathname: '/'
        }, {
          writeOnlyHead: this.callback // XXX: Can't actually test http.ServerResponse.prototype.writeOnlyHead
        });
      },
      'responds with a redirect to /game/': function (status, headers) {
        assert.equal(status, httpStatus.FOUND);
        assert.equal(headers, { 'Location': '/game/' });
      }
    }
  }
}).export(module);
