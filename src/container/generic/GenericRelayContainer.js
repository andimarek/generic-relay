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
 * @flow
 */

'use strict';

import type {
  Abortable,
  ComponentReadyStateChangeCallback,
  RelayContainer,
  RelayProp,
  Subscription,
  Variables,
} from 'RelayTypes';
import type {ConcreteFragment} from 'ConcreteQuery';
import type {ContainerCallback, ContainerDataState} from 'GenericRelayRootContainer';
// import type {RelayContainerSpec, RelayLazyContainer, RelayQueryConfigSpec} from 'RelayContainer';
import type RelayMutationTransaction from 'RelayMutationTransaction';
import type {RelayQLFragmentBuilder, RelayQLQueryBuilder} from 'buildRQL';
import type URI from 'URI';


const GraphQLFragmentPointer = require('GraphQLFragmentPointer');
const RelayRecord = require('RelayRecord');
const GraphQLStoreQueryResolver = require('GraphQLStoreQueryResolver');
const RelayFragmentReference = require('RelayFragmentReference');
const RelayMetaRoute = require('RelayMetaRoute');
const RelayStore = require('RelayStore');
const RelayStoreData = require('RelayStoreData');

const buildRQL = require('buildRQL');
const forEachObject = require('forEachObject');
const invariant = require('invariant');
const shallowEqual = require('shallowEqual');
const warning = require('warning');
const {createQuerySetAndFragmentPointers,
  createFragmentPointers} = require('createQuerySetAndFragmentPointers');

export type RelayContainerSpec = {
  initialVariables?: Variables;
  prepareVariables?: (
    prevVariables: Variables,
    route: RelayMetaRoute
  ) => Variables;
  fragments: {
    [propName: string]: RelayQLFragmentBuilder
  };
};
export type RelayLazyContainer = Function;
export type RelayQueryConfigSpec = {
  name: string;
  params: Variables;
  queries: RootQueries;
  uri?: ?URI;
  useMockData?: bool;
};
export type RootQueries = {
  [queryName: string]: RelayQLQueryBuilder;
};


var storeData = RelayStoreData.getDefaultInstance();

type FragmentInput = {[key: string]: mixed};

type RouteFragmentInput = {
  route: RelayQueryConfigSpec,
  fragmentInput: FragmentInput
}

function createContainerComponent(
  containerName: string,
  containerSpec: RelayContainerSpec
): any {

  var fragments = containerSpec.fragments;
  var fragmentNames = Object.keys(fragments);

  const doneState = {done:true, ready:true, aborted:false, stale:false};

  class GenericRelayContainer {
    callback: ContainerCallback;

    fragmentInput: FragmentInput;
    variables: Variables;
    route: RelayQueryConfigSpec;

    _fragmentPointers: {[key: string]: ?GraphQLFragmentPointer};
    _hasStaleQueryData: boolean;
    _queryResolvers: {[key: string]: ?GraphQLStoreQueryResolver};

    queryData: {[propName: string]: mixed};


    pending: ?{
      variables: Variables;
      request: Abortable;
    };


    constructor(callback: ContainerCallback, partialVariables: ?Variables) {
      invariant(callback != null, 'A callback function must be provided');
      this.callback = callback;

      var self: any = this;
      self.cleanup = this.cleanup.bind(this);
      self.updateFragmentInput = this.updateFragmentInput.bind(this);
      self.updateRoute = this.updateRoute.bind(this);
      self.update = this.update.bind(this);
      self.setVariables = this.setVariables.bind(this);
      self.forceFetch = this.forceFetch.bind(this);
      self.getPendingTransactions = this.getPendingTransactions.bind(this);
      self.hasOptimisticUpdate = this.hasOptimisticUpdate.bind(this);


      this.variables = mergeVariables(containerName.initialVariables || {}, partialVariables )

      this._fragmentPointers = {};
      this._hasStaleQueryData = false;
      this._queryResolvers = {};

      this.pending = null;
      this.queryData = {};

    }


    cleanup(): void {
      if (this._queryResolvers) {
        forEachObject(
          this._queryResolvers,
          queryResolver => queryResolver && queryResolver.reset()
        );
      }

      this._fragmentPointers = {};
      this._queryResolvers = {};

      var pending = this.pending;
      if (pending) {
        pending.request.abort();
        this.pending = null;
      }

    }


    updateFragmentInput(fragmentInput: FragmentInput): void {
      this.update({route:this.route, fragmentInput });
    }

    updateRoute(route: RelayQueryConfigSpec): void {
      this.update({route, fragmentInput: this.fragmentInput });
    }

    update(routeAndFragmentInput: RouteFragmentInput): void {
      this.fragmentInput = routeAndFragmentInput.fragmentInput;
      this.route = routeAndFragmentInput.route;
      invariant(this.route != null, 'route must be not null for an update');
      invariant(this.fragmentInput != null, 'fragmentInput must be not null for an update');

      this._fragmentPointers =  createFragmentPointers(
        containerName,
        this.fragmentInput,
        this.route,
        this.variables,
         containerSpec);
      this._updateQueryResolvers();

      const queryData = this._getQueryData(this.fragmentInput);
      this._updateState(
        this.variables,
        {data: queryData, ...doneState}
      );
    }


    setVariables(partialVariables: Variables): void {
      this._runVariables(partialVariables, false);
    }

    forceFetch(partialVariables?: ?Variables): void {
      this._runVariables(partialVariables, true);
    }

    /**
     * Determine if the supplied record reflects an optimistic update.
     */
    hasOptimisticUpdate(
      record: Object
    ): boolean {
      var dataID = RelayRecord.getDataID(record);
      invariant(
        dataID != null,
        'GenericRelayContainer.hasOptimisticUpdate(): Expected a record in `%s`.',
        containerName,
      );
      return storeData.hasOptimisticUpdate(dataID);
    }

    /**
     * Returns the pending mutation transactions affecting the given record.
     */
    getPendingTransactions(record: Object): ?Array<RelayMutationTransaction> {
      const dataID = RelayRecord.getDataID(record);
      invariant(
        dataID != null,
        'GenericRelayContainer.getPendingTransactions(): Expected a record in `%s`.',
        containerName
      );
      const mutationIDs = storeData.getClientMutationIDs(dataID);
      if (!mutationIDs) {
        return null;
      }
      const mutationQueue = storeData.getMutationQueue();
      return mutationIDs.map(id => mutationQueue.getTransaction(id));
    }


    _runVariables(
      partialVariables: ?Variables,
      forceFetch: boolean
    ): void {
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
        ({querySet, fragmentPointers} =
          createQuerySetAndFragmentPointers(
          containerName,
          storeData,
          nextVariables,
          this.route,
          containerSpec,
          this.queryData));
      }

      const onReadyStateChange = readyState => {
        const {aborted, done, error, ready} = readyState;
        var isComplete = aborted || done || error;
        if (isComplete && this.pending === current) {
          this.pending = null;
        }
        if (ready && fragmentPointers) {
          this._fragmentPointers = fragmentPointers;
          this._updateQueryResolvers();
          var queryData = this._getQueryData(this.fragmentInput);
          this._updateState(nextVariables, {data: queryData, ...readyState});
        }

      };

      const request = forceFetch ?
        RelayStore.forceFetch(querySet, onReadyStateChange) :
        RelayStore.primeCache(querySet, onReadyStateChange);

      var current = {
        variables: nextVariables,
        request,
      };
      this.pending = current;
    }

    _updateState(variables:Variables, newState: ContainerDataState) {
      this.variables = variables;
      this.queryData = newState.data;
      this.callback(newState);
    }

    _updateQueryResolvers(): void {
      var fragmentPointers = this._fragmentPointers;
      var queryResolvers = this._queryResolvers;
      fragmentNames.forEach(fragmentName => {
        var fragmentPointer = fragmentPointers[fragmentName];
        var queryResolver = queryResolvers[fragmentName];
        if (!fragmentPointer) {
          if (queryResolver) {
            queryResolver.reset();
            queryResolvers[fragmentName] = null;
          }
        } else if (!queryResolver) {
          queryResolver = new GraphQLStoreQueryResolver(
            storeData,
            fragmentPointer,
            this._handleFragmentDataUpdate.bind(this)
          );
          queryResolvers[fragmentName] = queryResolver;
        }
      });
    }

    _handleFragmentDataUpdate(): void {
      const queryData = this._getQueryData(this.fragmentInput);
      this._updateState(this.variables, {data:queryData, ...doneState});
    }



    _getQueryData(
      fragmentInput: Object
    ): Object {
      var queryData = {};
      var fragmentPointers = this._fragmentPointers;
      forEachObject(this._queryResolvers, (queryResolver, fragmentName) => {
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
        if (this.queryData.hasOwnProperty(fragmentName) &&
            queryData[fragmentName] !== this.queryData[fragmentName]) {
          this._hasStaleQueryData = true;
        }
      });
      return queryData;
    }

}

  return GenericRelayContainer;
}


/**
 * Merges a partial update into a set of variables. If no variables changed, the
 * same object is returned. Otherwise, a new object is returned.
 */
function mergeVariables(
  currentVariables: Variables,
  partialVariables: ?Variables
): Variables {
  if (partialVariables) {
    for (var key in partialVariables) {
      if (currentVariables[key] !== partialVariables[key]) {
        return {...currentVariables, ...partialVariables};
      }
    }
  }
  return currentVariables;
}

function buildContainerFragment(
  containerName: string,
  fragmentName: string,
  fragmentBuilder: RelayQLFragmentBuilder,
  variables: Variables
): ConcreteFragment {
  var fragment = buildRQL.Fragment(
    fragmentBuilder,
    variables
  );
  invariant(
    fragment,
    'Relay.QL defined on container `%s` named `%s` is not a valid fragment. ' +
    'A typical fragment is defined using: Relay.QL`fragment on Type {...}`',
    containerName,
    fragmentName
  );
  return fragment;
}

function create(
  containerName: string,
  containerSpec: RelayContainerSpec
): RelayLazyContainer {

  var fragments = containerSpec.fragments;
  invariant(
    typeof fragments === 'object' && fragments,
    'Relay.createGenericContainer(%s, ...): Missing `fragments`, which is expected ' +
    'to be an object mapping from `propName` to: () => Relay.QL`...`',
    containerName
  );
  var fragmentNames = Object.keys(fragments);
  var initialVariables = containerSpec.initialVariables || {};
  var prepareVariables = containerSpec.prepareVariables;

  var Container;
  function ContainerConstructor(props, callback) {
    if (!Container) {
      Container = createContainerComponent(containerName, containerSpec);
    }
    return new Container(props, callback);
  }

  ContainerConstructor.getFragmentNames = () => fragmentNames;
  ContainerConstructor.hasFragment = fragmentName => !!fragments[fragmentName];
  ContainerConstructor.hasVariable = variableName =>
    Object.prototype.hasOwnProperty.call(initialVariables, variableName);

  ContainerConstructor.getFragment = function(
    fragmentName: string,
    variableMapping?: Variables
  ): RelayFragmentReference {
    var fragmentBuilder = fragments[fragmentName];
    if (!fragmentBuilder) {
      invariant(
        false,
        '%s.getFragment(): `%s` is not a valid fragment name. Available ' +
        'fragments names: %s',
        containerName,
        fragmentName,
        fragmentNames.map(name => '`' + name + '`').join(', ')
      );
    }
    invariant(
      typeof fragmentBuilder === 'function',
      'GenericRelayContainer: Expected `%s.fragments.%s` to be a function returning '+
      'a fragment. Example: `%s: () => Relay.QL`fragment on ...`',
      containerName,
      fragmentName,
      fragmentName
    );
    return RelayFragmentReference.createForContainer(
      () => buildContainerFragment(
        containerName,
        fragmentName,
        fragmentBuilder,
        initialVariables
      ),
      initialVariables,
      variableMapping,
      prepareVariables
    );
  };

  ContainerConstructor.displayName = containerName;
  ContainerConstructor.moduleName = (null: ?string);

  return ContainerConstructor;
}

module.exports = {create};
