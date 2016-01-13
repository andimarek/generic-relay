# Generic-Relay

_Important_: This is an experimental project which will be very likely deprecated when Relay has a clearly defined Relay-Core (See ["Define a clear boundary between Relay Core & Relay/React"](https://github.com/facebook/relay/issues/559)).


## Overview

This is a modified version of [Relay](https://github.com/facebook/relay) with the goal to be used without React.


Main changes:
- The name is `generic-relay` and not `react-relay`.
- It doesn't depend on React anymore and all React related code is deleted or commented out.
- New modules are added to replace `RelayContainer` et al.

## How to use it

Because it's highly experimental there will be no releases. You have to clone the repo and install it into your project: `npm install <path-to-cloned-repo>`.

The main idea is, not to depend on any specific view technology, but keep everything else.
That means `RelayContainer` is replaced with `GenericRelayContainer`:

```
const StarWarsShipComponent = Relay.createGenericContainer('StarWarsShip', {
  fragments: {
    ship: () => Relay.QL`
       fragment on Ship {
         name
       }
    `,
  },
});
```
This component can then be instantiated with a callback function:

```
const updateCallback = (state) => {
  if(state.ready) {
    ... state.data.ship is available
  }
};
const starWarsApp = new StarWarsAppComponent({}, updateCallback);
```

Anytime the input for the component changes, you have to call update:
```
starWarsApp.update(input);
```
And when new data is available your registered callback function is informed.


First create an instance of `GenericRelayRootContainer` and register a callback.
This callback will be called whenever new data is available.

There is a working example of Relay with Angular in the examples folder: [star-wars-angular](examples/star-wars-angular)


## Original Relay License (by Facebook)

Relay is [BSD licensed](./LICENSE). Facebook also provide an additional [patent grant](./PATENTS).
