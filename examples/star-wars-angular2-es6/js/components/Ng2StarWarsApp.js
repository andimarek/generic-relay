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
  template: `
    App
      <ul>
        <li *ngFor="#faction of relayData.factions;">
          {{faction.name}}
        </li>
      </ul>`
})
class StarWarsApp {
  @Input() relayProps = '';
  @Input() route = '';

  constructor() {
    this.relayData = {factions: []};
    const updateListener = (state) => {
      this.relayData = state.data;
    };
    this.starWarsApp = new StarWarsAppContainer(updateListener);
  }

  ngOnChanges(newState) {

    const route = newState.route ? newState.route.currentValue : this.route;
    const relayProps = newState.relayProps ? newState.relayProps.currentValue : this.relayProps;
    
    if (route && relayProps) {
      this.starWarsApp.update({route: route, fragmentInput: relayProps});
    }
  }

}

export { StarWarsAppContainer, StarWarsApp };
