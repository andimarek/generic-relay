/**
* @providesModule createQuerySetAndFragmentPointers
* 
*/

'use strict';

var _Object$keys = require('babel-runtime/core-js/object/keys')['default'];

var RelayMetaRoute = require('./RelayMetaRoute');
var RelayQuery = require('./RelayQuery');
var RelayStoreData = require('./RelayStoreData');

var buildRQL = require('./buildRQL');
var invariant = require('fbjs/lib/invariant');
var forEachObject = require('fbjs/lib/forEachObject');
var warning = require('fbjs/lib/warning');

var GraphQLFragmentPointer = require('./GraphQLFragmentPointer');
var RelayRecord = require('./RelayRecord');

function createQuerySetAndFragmentPointers(containerName, storeData, variables, route, containerSpec, currentData) {
  var fragmentPointers = {};
  var querySet = {};

  forEachObject(containerSpec.fragments, function (fragmentBuilder, fragmentName) {
    var fragment = createFragmentQueryNode(containerName, fragmentName, variables, route, containerSpec);
    var queryData = currentData[fragmentName];
    if (!fragment || queryData == null) {
      return;
    }

    var fragmentPointer;
    if (fragment.isPlural()) {
      !Array.isArray(queryData) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'GenericRelayContainer: Invalid queryData for `%s`, expected an array ' + 'of records because the corresponding fragment is plural.', fragmentName) : invariant(false) : undefined;
      var dataIDs = [];
      queryData.forEach(function (data, ii) {
        var dataID = RelayRecord.getDataID(data);
        if (dataID) {
          querySet[fragmentName + ii] = storeData.buildFragmentQueryForDataID(fragment, dataID);
          dataIDs.push(dataID);
        }
      });
      if (dataIDs.length) {
        fragmentPointer = new GraphQLFragmentPointer(dataIDs, fragment);
      }
    } else {
      var dataID = RelayRecord.getDataID(queryData);
      if (dataID) {
        fragmentPointer = new GraphQLFragmentPointer(dataID, fragment);
        querySet[fragmentName] = storeData.buildFragmentQueryForDataID(fragment, dataID);
      }
    }

    fragmentPointers[fragmentName] = fragmentPointer;
  });
  return { fragmentPointers: fragmentPointers, querySet: querySet };
}

function createFragmentPointers(containerName, fragmentInput, route, variables, containerSpec) {

  var result = {};

  forEachObject(containerSpec.fragments, function (fragmentBuilder, fragmentName) {
    var propValue = fragmentInput[fragmentName];
    warnAboutMissingProp(propValue, fragmentName, containerName);

    if (!propValue) {
      result[fragmentName] = null;
      return;
    }
    var fragment = createFragmentQueryNode(containerName, fragmentName, variables, route, containerSpec);
    var concreteFragmentHash = fragment.getConcreteNodeHash();
    var dataIDOrIDs = undefined;

    if (fragment.isPlural()) {
      // Plural fragments require the prop value to be an array of fragment
      // pointers, which are merged into a single fragment pointer to pass
      // to the query resolver `resolve`.
      !Array.isArray(propValue) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'GenericRelayContainer: Invalid prop `%s` supplied to `%s`, expected an ' + 'array of records because the corresponding fragment is plural.', fragmentName, containerName) : invariant(false) : undefined;
      if (propValue.length) {
        dataIDOrIDs = propValue.reduce(function (acc, item, ii) {
          var eachFragmentPointer = item[concreteFragmentHash];
          !eachFragmentPointer ? process.env.NODE_ENV !== 'production' ? invariant(false, 'GenericRelayContainer: Invalid prop `%s` supplied to `%s`, ' + 'expected element at index %s to have query data.', fragmentName, containerName, ii) : invariant(false) : undefined;
          return acc.concat(eachFragmentPointer.getDataIDs());
        }, []);
      } else {
        // An empty plural fragment cannot be observed; the empty array prop
        // can be passed as-is to the component.
        dataIDOrIDs = null;
      }
    } else {
      !!Array.isArray(propValue) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'GenericRelayContainer: Invalid prop `%s` supplied to `%s`, expected a ' + 'single record because the corresponding fragment is not plural.', fragmentName, containerName) : invariant(false) : undefined;
      var fragmentPointer = propValue[concreteFragmentHash];
      if (fragmentPointer) {
        dataIDOrIDs = fragmentPointer.getDataID();
      } else {
        dataIDOrIDs = null;
      }
    }
    result[fragmentName] = dataIDOrIDs ? new GraphQLFragmentPointer(dataIDOrIDs, fragment) : null;
  });
  if (process.env.NODE_ENV !== 'production') {
    warnAboutMisplacedProps(containerName, fragmentInput, variables, route, containerSpec, result);
  }

  return result;
}

function warnAboutMissingProp(propValue, fragmentName, containerName) {
  process.env.NODE_ENV !== 'production' ? warning(propValue !== undefined, 'GenericRelayContainer: Expected query `%s` to be supplied to `%s` as ' + 'a value from the parent. Pass an explicit `null` if this is ' + 'intentional.', fragmentName, containerName) : undefined;
}

function warnAboutMisplacedProps(containerName, props, variables, route, containerSpec, fragmentPointers) {

  forEachObject(containerSpec.fragments, function (fragmentBuilder, fragmentName) {
    if (fragmentPointers[fragmentName]) {
      return;
    }
    var fragment = createFragmentQueryNode(containerName, fragmentName, variables, route, containerSpec);
    var concreteFragmentHash = fragment.getConcreteNodeHash();
    _Object$keys(props).forEach(function (propName) {
      process.env.NODE_ENV !== 'production' ? warning(fragmentPointers[propName] || !RelayRecord.isRecord(props[propName]) || !props[propName][concreteFragmentHash], 'GenericRelayContainer: Expected record data for prop `%s` on `%s`, ' + 'but it was instead on prop `%s`. Did you misspell a prop or ' + 'pass record data into the wrong prop?', fragmentName, containerName, propName) : undefined;
    });
  });
}

function createFragmentQueryNode(containerName, fragmentName, variables, route, containerSpec) {
  var fragmentBuilder = containerSpec.fragments[fragmentName];
  !fragmentBuilder ? process.env.NODE_ENV !== 'production' ? invariant(false, 'GenericRelayContainer: Expected `%s` to have a query fragment named `%s`.', containerName, fragmentName) : invariant(false) : undefined;
  var fragment = buildContainerFragment(containerName, fragmentName, fragmentBuilder, containerSpec.initialVariables || {});
  // TODO: Allow routes without names, #7856965.
  var metaRoute = RelayMetaRoute.get(route.name);
  if (containerSpec.prepareVariables) {
    variables = containerSpec.prepareVariables(variables, metaRoute);
  }
  return RelayQuery.Fragment.create(fragment, metaRoute, variables);
}

function buildContainerFragment(containerName, fragmentName, fragmentBuilder, variables) {
  var fragment = buildRQL.Fragment(fragmentBuilder, variables);
  !fragment ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Relay.QL defined on container `%s` named `%s` is not a valid fragment. ' + 'A typical fragment is defined using: Relay.QL`fragment on Type {...}`', containerName, fragmentName) : invariant(false) : undefined;
  return fragment;
}

module.exports = { createQuerySetAndFragmentPointers: createQuerySetAndFragmentPointers, createFragmentPointers: createFragmentPointers };