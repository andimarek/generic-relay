/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule GenericRelayContainer
 * @typechecks
 * 
 */

'use strict';

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _extends = require('babel-runtime/helpers/extends')['default'];

var _Object$keys = require('babel-runtime/core-js/object/keys')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var GraphQLFragmentPointer = require('./GraphQLFragmentPointer');
var RelayRecord = require('./RelayRecord');
var GraphQLStoreQueryResolver = require('./GraphQLStoreQueryResolver');
var RelayFragmentReference = require('./RelayFragmentReference');
var RelayMetaRoute = require('./RelayMetaRoute');
var RelayStore = require('./RelayStore');
var RelayStoreData = require('./RelayStoreData');

var buildRQL = require('./buildRQL');
var forEachObject = require('fbjs/lib/forEachObject');
var invariant = require('fbjs/lib/invariant');
var shallowEqual = require('fbjs/lib/shallowEqual');
var warning = require('fbjs/lib/warning');

var _require = require('./createQuerySetAndFragmentPointers');

var createQuerySetAndFragmentPointers = _require.createQuerySetAndFragmentPointers;
var createFragmentPointers = _require.createFragmentPointers;

var storeData = RelayStoreData.getDefaultInstance();

function createContainerComponent(containerName, containerSpec) {

  var fragments = containerSpec.fragments;
  var fragmentNames = _Object$keys(fragments);

  var doneState = { done: true, ready: true, aborted: false, stale: false };

  var GenericRelayContainer = (function () {
    function GenericRelayContainer(dataChangeListener, partialVariables) {
      _classCallCheck(this, GenericRelayContainer);

      !(dataChangeListener != null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'A listener function must be provided') : invariant(false) : undefined;
      this.dataChangeListener = dataChangeListener;

      var self = this;
      self.cleanup = this.cleanup.bind(this);
      self.updateFragmentInput = this.updateFragmentInput.bind(this);
      self.updateRoute = this.updateRoute.bind(this);
      self.update = this.update.bind(this);
      self.setVariables = this.setVariables.bind(this);
      self.forceFetch = this.forceFetch.bind(this);
      self.getPendingTransactions = this.getPendingTransactions.bind(this);
      self.hasOptimisticUpdate = this.hasOptimisticUpdate.bind(this);

      this.variables = mergeVariables(containerName.initialVariables || {}, partialVariables);

      this._fragmentPointers = {};
      this._hasStaleQueryData = false;
      this._queryResolvers = {};

      this.pending = null;
      this.queryData = {};
    }

    GenericRelayContainer.prototype.cleanup = function cleanup() {
      if (this._queryResolvers) {
        forEachObject(this._queryResolvers, function (queryResolver) {
          return queryResolver && queryResolver.reset();
        });
      }

      this._fragmentPointers = {};
      this._queryResolvers = {};

      var pending = this.pending;
      if (pending) {
        pending.request.abort();
        this.pending = null;
      }
    };

    GenericRelayContainer.prototype.updateFragmentInput = function updateFragmentInput(fragmentInput) {
      this.update({ route: this.route, fragmentInput: fragmentInput });
    };

    GenericRelayContainer.prototype.updateRoute = function updateRoute(route) {
      this.update({ route: route, fragmentInput: this.fragmentInput });
    };

    GenericRelayContainer.prototype.update = function update(routeAndFragmentInput) {
      this.fragmentInput = routeAndFragmentInput.fragmentInput;
      this.route = routeAndFragmentInput.route;
      !(this.route != null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'route must be not null for an update') : invariant(false) : undefined;
      !(this.fragmentInput != null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'fragmentInput must be not null for an update') : invariant(false) : undefined;

      this._fragmentPointers = createFragmentPointers(containerName, this.fragmentInput, this.route, this.variables, containerSpec);
      this._updateQueryResolvers();

      var queryData = this._getQueryData(this.fragmentInput);
      this._newDataAvailable(_extends({ data: queryData }, doneState));
    };

    GenericRelayContainer.prototype.setVariables = function setVariables(partialVariables) {
      this._runVariables(partialVariables, false);
    };

    GenericRelayContainer.prototype.forceFetch = function forceFetch(partialVariables) {
      this._runVariables(partialVariables, true);
    };

    /**
     * Determine if the supplied record reflects an optimistic update.
     */

    GenericRelayContainer.prototype.hasOptimisticUpdate = function hasOptimisticUpdate(record) {
      var dataID = RelayRecord.getDataID(record);
      !(dataID != null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'GenericRelayContainer.hasOptimisticUpdate(): Expected a record in `%s`.', containerName) : invariant(false) : undefined;
      return storeData.hasOptimisticUpdate(dataID);
    };

    /**
     * Returns the pending mutation transactions affecting the given record.
     */

    GenericRelayContainer.prototype.getPendingTransactions = function getPendingTransactions(record) {
      var dataID = RelayRecord.getDataID(record);
      !(dataID != null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'GenericRelayContainer.getPendingTransactions(): Expected a record in `%s`.', containerName) : invariant(false) : undefined;
      var mutationIDs = storeData.getClientMutationIDs(dataID);
      if (!mutationIDs) {
        return null;
      }
      var mutationQueue = storeData.getMutationQueue();
      return mutationIDs.map(function (id) {
        return mutationQueue.getTransaction(id);
      });
    };

    GenericRelayContainer.prototype._runVariables = function _runVariables(partialVariables, forceFetch) {
      var _this = this;

      !(this.fragmentInput != null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'container must be updated before variables can be changed') : invariant(false) : undefined;

      var lastVariables = this.variables;
      var prevVariables = this.pending ? this.pending.variables : lastVariables;
      var nextVariables = mergeVariables(prevVariables, partialVariables);

      this.pending && this.pending.request.abort();

      // If variables changed or we are force-fetching, we need to build a new
      // set of queries that includes the updated variables. Because the pending
      // fetch is always canceled, always initiate a new fetch.
      var querySet = {};
      var fragmentPointers = null;
      if (forceFetch || !shallowEqual(nextVariables, lastVariables)) {
        var _createQuerySetAndFragmentPointers = createQuerySetAndFragmentPointers(containerName, storeData, nextVariables, this.route, containerSpec, this.queryData);

        querySet = _createQuerySetAndFragmentPointers.querySet;
        fragmentPointers = _createQuerySetAndFragmentPointers.fragmentPointers;
      }

      var onReadyStateChange = function onReadyStateChange(readyState) {
        var aborted = readyState.aborted;
        var done = readyState.done;
        var error = readyState.error;
        var ready = readyState.ready;

        var isComplete = aborted || done || error;
        if (isComplete && _this.pending === current) {
          _this.pending = null;
        }
        if (ready && fragmentPointers) {
          _this._fragmentPointers = fragmentPointers;
          _this._updateQueryResolvers();
          var queryData = _this._getQueryData(_this.fragmentInput);
          _this._newDataAvailable(_extends({ data: queryData }, readyState));
        }
      };

      var request = forceFetch ? RelayStore.forceFetch(querySet, onReadyStateChange) : RelayStore.primeCache(querySet, onReadyStateChange);

      var current = {
        variables: nextVariables,
        request: request
      };
      this.pending = current;
    };

    GenericRelayContainer.prototype._newDataAvailable = function _newDataAvailable(newState) {
      this.queryData = newState.data;
      this.dataChangeListener(newState);
    };

    GenericRelayContainer.prototype._updateQueryResolvers = function _updateQueryResolvers() {
      var _this2 = this;

      var fragmentPointers = this._fragmentPointers;
      var queryResolvers = this._queryResolvers;
      fragmentNames.forEach(function (fragmentName) {
        var fragmentPointer = fragmentPointers[fragmentName];
        var queryResolver = queryResolvers[fragmentName];
        if (!fragmentPointer) {
          if (queryResolver) {
            queryResolver.reset();
            queryResolvers[fragmentName] = null;
          }
        } else if (!queryResolver) {
          queryResolver = new GraphQLStoreQueryResolver(storeData, fragmentPointer, _this2._handleFragmentDataUpdate.bind(_this2));
          queryResolvers[fragmentName] = queryResolver;
        }
      });
    };

    GenericRelayContainer.prototype._handleFragmentDataUpdate = function _handleFragmentDataUpdate() {
      var queryData = this._getQueryData(this.fragmentInput);
      this._newDataAvailable(_extends({ data: queryData }, doneState));
    };

    GenericRelayContainer.prototype._getQueryData = function _getQueryData(fragmentInput) {
      var _this3 = this;

      var queryData = {};
      var fragmentPointers = this._fragmentPointers;
      forEachObject(this._queryResolvers, function (queryResolver, fragmentName) {
        var fragmentInputValue = fragmentInput[fragmentName];
        var fragmentPointer = fragmentPointers[fragmentName];

        if (!fragmentInputValue || !fragmentPointer) {
          // Clear any subscriptions since there is no data.
          queryResolver && queryResolver.reset();
          // Allow mock data to pass through without modification.
          queryData[fragmentName] = fragmentInputValue;
        } else {
          queryData[fragmentName] = queryResolver.resolve(fragmentPointer);
        }
        if (_this3.queryData.hasOwnProperty(fragmentName) && queryData[fragmentName] !== _this3.queryData[fragmentName]) {
          _this3._hasStaleQueryData = true;
        }
      });
      return queryData;
    };

    return GenericRelayContainer;
  })();

  return GenericRelayContainer;
}

/**
 * Merges a partial update into a set of variables. If no variables changed, the
 * same object is returned. Otherwise, a new object is returned.
 */
function mergeVariables(currentVariables, partialVariables) {
  if (partialVariables) {
    for (var key in partialVariables) {
      if (currentVariables[key] !== partialVariables[key]) {
        return _extends({}, currentVariables, partialVariables);
      }
    }
  }
  return currentVariables;
}

function buildContainerFragment(containerName, fragmentName, fragmentBuilder, variables) {
  var fragment = buildRQL.Fragment(fragmentBuilder, variables);
  !fragment ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Relay.QL defined on container `%s` named `%s` is not a valid fragment. ' + 'A typical fragment is defined using: Relay.QL`fragment on Type {...}`', containerName, fragmentName) : invariant(false) : undefined;
  return fragment;
}

function create(containerName, containerSpec) {

  var fragments = containerSpec.fragments;
  !(typeof fragments === 'object' && fragments) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Relay.createGenericContainer(%s, ...): Missing `fragments`, which is expected ' + 'to be an object mapping from `propName` to: () => Relay.QL`...`', containerName) : invariant(false) : undefined;
  var fragmentNames = _Object$keys(fragments);
  var initialVariables = containerSpec.initialVariables || {};
  var prepareVariables = containerSpec.prepareVariables;

  var Container;
  function ContainerConstructor(props, callback) {
    if (!Container) {
      Container = createContainerComponent(containerName, containerSpec);
    }
    return new Container(props, callback);
  }

  ContainerConstructor.getFragmentNames = function () {
    return fragmentNames;
  };
  ContainerConstructor.hasFragment = function (fragmentName) {
    return !!fragments[fragmentName];
  };
  ContainerConstructor.hasVariable = function (variableName) {
    return Object.prototype.hasOwnProperty.call(initialVariables, variableName);
  };

  ContainerConstructor.getFragment = function (fragmentName, variableMapping) {
    var fragmentBuilder = fragments[fragmentName];
    if (!fragmentBuilder) {
      !false ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s.getFragment(): `%s` is not a valid fragment name. Available ' + 'fragments names: %s', containerName, fragmentName, fragmentNames.map(function (name) {
        return '`' + name + '`';
      }).join(', ')) : invariant(false) : undefined;
    }
    !(typeof fragmentBuilder === 'function') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'GenericRelayContainer: Expected `%s.fragments.%s` to be a function returning ' + 'a fragment. Example: `%s: () => Relay.QL`fragment on ...`', containerName, fragmentName, fragmentName) : invariant(false) : undefined;
    return RelayFragmentReference.createForContainer(function () {
      return buildContainerFragment(containerName, fragmentName, fragmentBuilder, initialVariables);
    }, initialVariables, variableMapping, prepareVariables);
  };

  ContainerConstructor.displayName = containerName;
  ContainerConstructor.moduleName = null;

  return ContainerConstructor;
}

module.exports = { create: create };