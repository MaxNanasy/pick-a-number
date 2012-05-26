#!/usr/bin/env node
require('http').createServer(require('./request-handler-factory')()).listen(8080);
