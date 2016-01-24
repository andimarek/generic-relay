/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule GenericRelayRootContainer
 * @typechecks
 * 
 */

'use strict';

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _extends = require('babel-runtime/helpers/extends')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var GraphQLFragmentPointer = require('./GraphQLFragmentPointer');
var RelayStore = require('./RelayStore');
var RelayStoreData = require('./RelayStoreData');

var getRelayQueries = require('./getRelayQueries');
var mapObject = require('fbjs/lib/mapObject');

var GenericRelayRootContainer = (function () {
  function GenericRelayRootContainer(dataChangeListener) {
    _classCallCheck(this, GenericRelayRootContainer);

    this.dataChangeListener = dataChangeListener;
  }

  GenericRelayRootContainer.prototype.update = function update(Container, route, forceFetch) {
    this.active = true;
    this.Container = Container;
    this.route = route;
    this._runQueries(forceFetch != null ? forceFetch : false);
  };

  GenericRelayRootContainer.prototype.cleanup = function cleanup() {
    if (this.pendingRequest) {
      this.pendingRequest.abort();
    }
    this.active = false;
  };

  GenericRelayRootContainer.prototype._runQueries = function _runQueries(forceFetch) {
    var _this = this;

    var querySet = getRelayQueries(this.Container, this.route);
    var onReadyStateChange = function onReadyStateChange(readyState) {
      if (!_this.active) {
        return;
      }
      if (request !== _this.pendingRequest) {
        // Ignore (abort) ready state if we have a new pending request.
        return;
      }
      if (readyState.aborted || readyState.done || readyState.error) {
        _this.pendingRequest = null;
      }
      if (readyState.ready) {
        var _data = _extends({
          route: _this.route
        }, _this.route.params, mapObject(querySet, createFragmentPointerForRoot));
        _this._informListener(_extends({ data: _data }, readyState));
      }
    };

    var request = forceFetch ? RelayStore.forceFetch(querySet, onReadyStateChange) : RelayStore.primeCache(querySet, onReadyStateChange);
    this.pendingRequest = request;
  };

  GenericRelayRootContainer.prototype._informListener = function _informListener(state) {
    this.dataChangeListener(state);
  };

  return GenericRelayRootContainer;
})();

function createFragmentPointerForRoot(query) {
  return query ? GraphQLFragmentPointer.createForRoot(RelayStoreData.getDefaultInstance().getQueuedStore(), query) : null;
}

module.exports = GenericRelayRootContainer;