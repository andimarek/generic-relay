import Relay from 'generic-relay';
import { Component, Input } from 'angular2/core';

const StarWarsAppContainer = Relay.createGenericContainer('StartWarsApp', {
  fragments: {
    factions: () => Relay.QL`
      fragment on Faction @relay(plural: true) {
        name
      }
    `,
  },
});

@Component({
  selector: 'star-wars-app',
  template: '<p>App</p>'
})
class StarWarsApp {
  @Input() relayProps;
  @Input() route;

  constructor() {
  }
}

export { StarWarsAppContainer, StarWarsApp };
