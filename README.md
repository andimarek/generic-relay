# Generic-Relay

####*Important*: This is an experimental project which will be very likely deprecated when Relay has a clearly defined Relay-Core (See ["Define a clear boundary between Relay Core & Relay/React"](https://github.com/facebook/relay/issues/559)).


## Overview

This is a modified version of [Relay](https://github.com/facebook/relay) with the goal to be used without React.


Main changes:
- The name is `generic-relay` and not `react-relay`.
- It doesn't depend on React anymore and all React related code is removed.
- New modules are added to replace `RelayContainer` et al.

## How to use it

Because it's highly experimental there will be no releases. You have to clone the repo and install it into your project: `npm install <path-to-cloned-repo>`.

The main idea is, not to depend on any specific view technology, but keep everything else.
That means `RelayContainer` is replaced with `GenericRelayContainer` and every
Container should be paired with a UI-Component which renders the data provided by the Container.

Example:
```
const Container = Relay.createGenericContainer('ContainerName', {
  fragments: {
    someFragment: () => Relay.QL`
       fragment on Example {
         name
       }
    `,
  },
});
```
The second argument (the Container Specification) is exactly the same as in the normal `Relay.createContainer`.
(See the [doc](https://facebook.github.io/relay/docs/api-reference-relay-container.html#content) for details).


This container can then be instantiated with a listener function.
This callback function is there to inform you about new or changed data.

```
const updateListener = (state) => {
  if(state.ready) {
    ... state.data.someFragment is available ... normally render it with the paired UI-Component
  }
};
const container = new Container(updateListener);
```
Any container needs a [Route](https://facebook.github.io/relay/docs/api-reference-relay-route.html#content) and data for every fragment. The data
for the fragment comes from the parent component/container. How the data is passed down depends
on the view technology.

Initially and anytime the input for the component changes, you have to call update:
```
const dataFromParentComponent = ...
const route = ...
starWarsApp.update({route: route, fragmentInput: dataFromParentComponent);
```
And then when new data is available your listener function is called.

Initial variables for a specific instance
can be supplied in the constructor as second argument. They will be merged
with the initial variables of the container specifications.

To change variables after that use `setVariables(partialVariables)`. This will
trigger a refetch of data (and subsequently the listener is informed).

The root component creates an instance of `GenericRelayRootContainer`, again
with an listener:

```

const updateListener = (state) => {
  if(state.ready) {
    ... state.data is available ... pass it down in the Component/Container hierarchy
  }
};

const rootContainer = new Relay.GenericRootContainer(listener);
```
To initiate data fetching call `update` with a `GenericRelayContainer` and `Route`:

```
import Container from ....
const route = ...
rootContainer.update(Container, route);
```


There is a full working example of Relay with Angular in the examples folder: [star-wars-angular](examples/star-wars-angular)



## Original Relay License (by Facebook)

Relay is [BSD licensed](./LICENSE). Facebook also provide an additional [patent grant](./PATENTS).
