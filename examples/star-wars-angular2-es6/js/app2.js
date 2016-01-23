import 'zone.js/lib/browser/zone-microtask';
import 'reflect-metadata';
import 'babel/polyfill';

import {provide, Component, View} from 'angular2/core';
import {bootstrap} from 'angular2/platform/browser';
import {ROUTER_PROVIDERS, LocationStrategy, HashLocationStrategy} from 'angular2/router';


import Relay from 'generic-relay';
import StarWarsAppHomeRoute from './routes/StarWarsAppHomeRoute';

import { StarWarsApp, StarWarsAppContainer } from './components/Ng2StarWarsApp';

@Component({
  selector: 'app'
})
@View({
  directives: [StarWarsApp],
  template: `
    <h1>Hello <star-wars-app [relay-props]="relayProps"></star-wars-app></h1>
  `
})
class App {
  constructor() {
    const route = new StarWarsAppHomeRoute({
      factionNames: ['empire', 'rebels'],
    });

    const listener = ({data}) => {
      console.log('received new data', data);
      this.relayProps = data;
    };

    const rootContainer = new Relay.GenericRootContainer(listener);
    rootContainer.update(StarWarsAppContainer, route);
  }

}

bootstrap(App, [
  ROUTER_PROVIDERS,
  provide(LocationStrategy, { useClass: HashLocationStrategy })
]);
