/**
* @providesModule createQuerySetAndFragmentPointers
* @flow
*/

import type {
  Variables,
} from 'RelayTypes';

import type {RelayQuerySet} from 'RelayInternalTypes';
import type {RelayQLFragmentBuilder} from 'buildRQL';
import type {ConcreteFragment} from 'ConcreteQuery';
import type {RelayContainerSpec, RelayQueryConfigSpec} from 'GenericRelayContainer';


const RelayMetaRoute = require('RelayMetaRoute');
const RelayQuery = require('RelayQuery');
const RelayStoreData = require('RelayStoreData');

const buildRQL = require('buildRQL');
const invariant = require('invariant');
const forEachObject = require('forEachObject');
const warning = require('warning');


const GraphQLFragmentPointer = require('GraphQLFragmentPointer');
const RelayRecord = require('RelayRecord');


function createQuerySetAndFragmentPointers(
  containerName: string,
  storeData: RelayStoreData,
  variables: Variables,
  route: RelayQueryConfigSpec,
  containerSpec: RelayContainerSpec,
  currentData: {[propName: string]: mixed}
): {
  fragmentPointers: {[key: string]: ?GraphQLFragmentPointer},
  querySet: RelayQuerySet,
} {
  var fragmentPointers = {};
  var querySet = {};

  forEachObject(containerSpec.fragments, (fragmentBuilder, fragmentName) => {
    var fragment = createFragmentQueryNode(
      containerName,
      fragmentName,
      variables,
      route,
      containerSpec
      );
    var queryData = currentData[fragmentName];
    if (!fragment || queryData == null) {
      return;
    }

    var fragmentPointer;
    if (fragment.isPlural()) {
      invariant(
        Array.isArray(queryData),
        'GenericRelayContainer: Invalid queryData for `%s`, expected an array ' +
        'of records because the corresponding fragment is plural.',
        fragmentName
      );
      var dataIDs = [];
      queryData.forEach((data, ii) => {
        var dataID = RelayRecord.getDataID(data);
        if (dataID) {
          querySet[fragmentName + ii] =
            storeData.buildFragmentQueryForDataID(fragment, dataID);
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
        querySet[fragmentName] =
          storeData.buildFragmentQueryForDataID(fragment, dataID);
      }
    }

    fragmentPointers[fragmentName] = fragmentPointer;
  });
  return {fragmentPointers, querySet};
}

function createFragmentPointers(
  containerName: string,
  fragmentInput: Object,
  route: RelayQueryConfigSpec,
  variables: Variables,
  containerSpec: RelayContainerSpec
): {[key: string]: ?GraphQLFragmentPointer} {

  const result:{[key: string]: ?GraphQLFragmentPointer}  = {};

  forEachObject(containerSpec.fragments, (fragmentBuilder, fragmentName) => {
    const propValue = fragmentInput[fragmentName];
    warnAboutMissingProp(propValue, fragmentName, containerName);

    if (!propValue) {
      result[fragmentName] = null;
      return;
    }
    const fragment = createFragmentQueryNode(
      containerName,
      fragmentName,
      variables,
      route,
      containerSpec
    );
    const concreteFragmentHash = fragment.getConcreteNodeHash();
    let dataIDOrIDs;

    if (fragment.isPlural()) {
      // Plural fragments require the prop value to be an array of fragment
      // pointers, which are merged into a single fragment pointer to pass
      // to the query resolver `resolve`.
      invariant(
        Array.isArray(propValue),
        'GenericRelayContainer: Invalid prop `%s` supplied to `%s`, expected an ' +
        'array of records because the corresponding fragment is plural.',
        fragmentName,
        containerName
      );
      if (propValue.length) {
        dataIDOrIDs = propValue.reduce((acc, item, ii) => {
          const eachFragmentPointer = item[concreteFragmentHash];
          invariant(
            eachFragmentPointer,
            'GenericRelayContainer: Invalid prop `%s` supplied to `%s`, ' +
            'expected element at index %s to have query data.',
            fragmentName,
            containerName,
            ii
          );
          return acc.concat(eachFragmentPointer.getDataIDs());
        }, []);
      } else {
        // An empty plural fragment cannot be observed; the empty array prop
        // can be passed as-is to the component.
        dataIDOrIDs = null;
      }
    } else {
      invariant(
        !Array.isArray(propValue),
        'GenericRelayContainer: Invalid prop `%s` supplied to `%s`, expected a ' +
        'single record because the corresponding fragment is not plural.',
        fragmentName,
        containerName
      );
      const fragmentPointer = propValue[concreteFragmentHash];
      if (fragmentPointer) {
        dataIDOrIDs = fragmentPointer.getDataID();
      } else {
        dataIDOrIDs = null;
      }
    }
    result[fragmentName] = dataIDOrIDs ?
      new GraphQLFragmentPointer(dataIDOrIDs, fragment) :
      null;
  });
  if (__DEV__) {
    warnAboutMisplacedProps(
      containerName,
      fragmentInput,
      variables,
      route,
      containerSpec,
      result
    );
  }


  return result;
}

function warnAboutMissingProp(propValue: Object, fragmentName: string,
  containerName: string): void {
  warning(
    propValue !== undefined,
    'GenericRelayContainer: Expected query `%s` to be supplied to `%s` as ' +
    'a value from the parent. Pass an explicit `null` if this is ' +
    'intentional.',
    fragmentName,
    containerName
  );

}

function warnAboutMisplacedProps(
  containerName: string,
  props: Object,
  variables: Variables,
  route: RelayQueryConfigSpec,
  containerSpec: RelayContainerSpec,
  fragmentPointers: {[key: string]: ?GraphQLFragmentPointer}
):void {

  forEachObject(containerSpec.fragments, (fragmentBuilder, fragmentName) => {
    if (fragmentPointers[fragmentName]) {
      return;
    }
    const fragment = createFragmentQueryNode(
      containerName,
      fragmentName,
      variables,
      route,
      containerSpec
    );
    const concreteFragmentHash = fragment.getConcreteNodeHash();
    Object.keys(props).forEach(propName => {
      warning(
        fragmentPointers[propName] ||
        !RelayRecord.isRecord(props[propName]) ||
        !props[propName][concreteFragmentHash],
        'GenericRelayContainer: Expected record data for prop `%s` on `%s`, ' +
        'but it was instead on prop `%s`. Did you misspell a prop or ' +
        'pass record data into the wrong prop?',
        fragmentName,
        containerName,
        propName
      );
    });
  });
}

function createFragmentQueryNode(
  containerName: string,
  fragmentName: string,
  variables: Variables,
  route: RelayQueryConfigSpec,
  containerSpec: RelayContainerSpec
): RelayQuery.Fragment {
  const fragmentBuilder = containerSpec.fragments[fragmentName];
  invariant(
    fragmentBuilder,
    'GenericRelayContainer: Expected `%s` to have a query fragment named `%s`.',
    containerName,
    fragmentName
  );
  var fragment = buildContainerFragment(
    containerName,
    fragmentName,
    fragmentBuilder,
    containerSpec.initialVariables || {}
  );
  // TODO: Allow routes without names, #7856965.
  var metaRoute = RelayMetaRoute.get(route.name);
  if (containerSpec.prepareVariables) {
    variables = containerSpec.prepareVariables(variables, metaRoute);
  }
  return RelayQuery.Fragment.create(
    fragment,
    metaRoute,
    variables
  );
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

module.exports = {createQuerySetAndFragmentPointers, createFragmentPointers};
