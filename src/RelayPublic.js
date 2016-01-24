/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule RelayPublic
 * @typechecks
 * @flow
 */

'use strict';

const RelayMutation = require('RelayMutation');
const RelayNetworkLayer = require('RelayNetworkLayer');
const RelayQL = require('RelayQL');
const RelayRoute = require('RelayRoute');
const RelayStore = require('RelayStore');
const RelayTaskScheduler = require('RelayTaskScheduler');
const RelayInternals = require('RelayInternals');

const createRelayQuery = require('createRelayQuery');
const getRelayQueries = require('getRelayQueries');
const isRelayContainer = require('isRelayContainer');
const GenericRelayRootContainer = require('GenericRelayRootContainer');
const GenericRelayContainer = require('GenericRelayContainer');

if (typeof global.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined') {
  global.__REACT_DEVTOOLS_GLOBAL_HOOK__._relayInternals = RelayInternals;
}

/**
 * Relay contains the set of public methods used to initialize and orchestrate
 * a React application that uses GraphQL to declare data dependencies.
 */
var RelayPublic = {
  Mutation: RelayMutation,
  QL: RelayQL,
  Route: RelayRoute,
  Store: RelayStore,

  createGenericContainer: GenericRelayContainer.create,
  GenericRootContainer: GenericRelayRootContainer,
  createQuery: createRelayQuery,
  getQueries: getRelayQueries,
  injectNetworkLayer: RelayNetworkLayer.injectNetworkLayer,
  injectTaskScheduler: RelayTaskScheduler.injectScheduler,
  isContainer: isRelayContainer,
};

module.exports = RelayPublic;
