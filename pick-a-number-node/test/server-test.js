#!/usr/bin/env node

var
  assert = require('assert'),
  server = injectr('../server', {
    http: {
      createServer: function (handleRequest) {
        assert.fail('FAIL!');
      }
    }
  });

require('vows').describe('Server').addBatch({
  'The server': {
    'when invoked with the path "/"': {
      topic: function () {
        server.this.callback, 2000);
      },
      'responds with a redirect to /game/': function () {
        assert.equal(0, 1);
      }
    }
  }
}).export(module);
