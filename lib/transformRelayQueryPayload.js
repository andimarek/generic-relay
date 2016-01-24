/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule transformRelayQueryPayload
 * 
 * @typechecks
 */

'use strict';

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var RelayQuery = require('./RelayQuery');
var RelayQueryVisitor = require('./RelayQueryVisitor');

var invariant = require('fbjs/lib/invariant');
var mapObject = require('fbjs/lib/mapObject');

/**
 * Transforms "client" payloads with property keys that match the "application"
 * names (i.e. property names are schema names or aliases) into "server"
 * payloads that match what the server would return for the given query (i.e.
 * property names are serialization keys instead).
 */
function transformRelayQueryPayload(root, clientData) {
  if (clientData == null) {
    return clientData;
  } else {
    return mapObject(clientData, function (item) {
      // Handle both FB & OSS formats for root payloads on plural calls: FB
      // returns objects, OSS returns arrays.
      if (Array.isArray(item)) {
        return item.map(function (innerItem) {
          return transform(root, innerItem);
        });
      }
      return transform(root, item);
    });
  }
}

function transform(root, clientData) {
  if (clientData == null) {
    return clientData;
  }
  var transform = new RelayPayloadTransformer();
  var serverData = {};
  transform.visit(root, {
    client: clientData,
    server: serverData
  });
  return serverData;
}

var RelayPayloadTransformer = (function (_RelayQueryVisitor) {
  _inherits(RelayPayloadTransformer, _RelayQueryVisitor);

  function RelayPayloadTransformer() {
    _classCallCheck(this, RelayPayloadTransformer);

    _RelayQueryVisitor.apply(this, arguments);
  }

  RelayPayloadTransformer.prototype.visitField = function visitField(node, state) {
    var _this = this;

    var client = state.client;
    var server = state.server;

    // `client` represents the *parent* node value and should not be null
    // due to checks before traversing child values.
    !(typeof client === 'object' && client !== null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'RelayPayloadTransformer: Expected a client value for field `%s`.', node.getApplicationName()) : invariant(false) : undefined;
    !(typeof server === 'object' && server !== null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'RelayPayloadTransformer: Expected a server value for field `%s`.', node.getApplicationName()) : invariant(false) : undefined;
    var applicationName = node.getApplicationName();
    var serializationKey = node.getSerializationKey();
    var clientData = client[applicationName];
    var serverData = server[serializationKey];

    if (node.isScalar() || clientData == null) {
      server[serializationKey] = clientData;
    } else if (Array.isArray(clientData)) {
      if (serverData == null) {
        server[serializationKey] = serverData = [];
      }
      clientData.forEach(function (clientItem, index) {
        !Array.isArray(serverData) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'RelayPayloadTransformer: Got conflicting values for field `%s`: ' + 'expected values to be arrays.', applicationName) : invariant(false) : undefined;
        if (clientItem == null) {
          serverData[index] = clientItem;
          return;
        }
        var serverItem = serverData && serverData[index];
        if (serverItem == null) {
          serverData[index] = serverItem = {};
        }
        _this.traverse(node, {
          client: clientItem,
          server: serverItem
        });
      });
    } else {
      !(typeof clientData === 'object' && clientData !== null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'RelayPayloadTransformer: Expected an object value for field `%s`.', applicationName) : invariant(false) : undefined;
      !(serverData == null || typeof serverData === 'object') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'RelayPayloadTransformer: Got conflicting values for field `%s`: ' + 'expected values to be objects.', applicationName) : invariant(false) : undefined;
      if (serverData == null) {
        server[serializationKey] = serverData = {};
      }
      this.traverse(node, {
        client: clientData,
        server: serverData
      });
    }
  };

  return RelayPayloadTransformer;
})(RelayQueryVisitor);

module.exports = transformRelayQueryPayload;