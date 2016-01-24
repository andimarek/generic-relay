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
 * @flow
 */

'use strict';

import type {
  Abortable
} from 'RelayTypes';
import type {RelayQueryConfigSpec} from 'GenericRelayContainer';

const GraphQLFragmentPointer = require('GraphQLFragmentPointer');
const RelayStore = require('RelayStore');
const RelayStoreData = require('RelayStoreData');

const getRelayQueries = require('getRelayQueries');
const mapObject = require('mapObject');

export type ContainerDataState = {
  done: boolean;
  ready: boolean;
  stale: boolean;
  aborted: boolean;
  error?: ?Error;
  data: {[key: string]: mixed}
};
export type DataChangeListener = (state: ContainerDataState) => void;


class GenericRelayRootContainer {
  dataChangeListener: DataChangeListener;

  Container: any;
  route: RelayQueryConfigSpec;

  active: boolean;
  pendingRequest: ?Abortable;


  constructor(dataChangeListener: DataChangeListener) {
    this.dataChangeListener = dataChangeListener;
  }

  update(Container: Object, route: RelayQueryConfigSpec, forceFetch: ?boolean) {
    this.active = true;
    this.Container = Container;
    this.route = route;
    this._runQueries(forceFetch != null ? forceFetch : false);
  }

  cleanup(): void {
    if (this.pendingRequest) {
      this.pendingRequest.abort();
    }
    this.active = false;
  }

  _runQueries(forceFetch: boolean) {
    const querySet = getRelayQueries(this.Container, this.route);
    const onReadyStateChange = readyState => {
      if (!this.active) {
        return;
      }
      if (request !== this.pendingRequest) {
        // Ignore (abort) ready state if we have a new pending request.
        return;
      }
      if (readyState.aborted || readyState.done || readyState.error) {
        this.pendingRequest = null;
      }
      if (readyState.ready) {
        const data = {
          route: this.route,
          ...this.route.params,
          ...mapObject(querySet, createFragmentPointerForRoot),
        };
        this._informListener({data, ...readyState});
      }
    };

    const request = forceFetch ?
      RelayStore.forceFetch(querySet, onReadyStateChange) :
      RelayStore.primeCache(querySet, onReadyStateChange);
    this.pendingRequest = request;
  }

  _informListener(state: ContainerDataState) {
    this.dataChangeListener(state);
  }
}

function createFragmentPointerForRoot(query) {
  return query ?
    GraphQLFragmentPointer.createForRoot(
      RelayStoreData.getDefaultInstance().getQueuedStore(),
      query
    ) :
    null;
}

module.exports = GenericRelayRootContainer;
