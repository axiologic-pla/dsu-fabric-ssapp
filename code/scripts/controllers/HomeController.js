import utils from "../utils.js";

const {FwController} = WebCardinal.controllers;

export default class HomeController extends FwController {
  constructor(...props) {
    super(...props);
    setTimeout(() => {
      utils.hideTextLoader();
    }, 100)

    const state = this.history.location.state;
    if (state && state.refreshTo) {
      console.log(`Redirecting to tag ${state.refreshTo.tag}...`);
      setTimeout(() => {
        this.navigateToPageTag(state.refreshTo.tag, state.refreshTo.state);
      }, 500);
    }
  }
}
