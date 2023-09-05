import {copyToClipboard} from "../helpers/document-utils.js";
import {getPermissionsWatcher} from "../services/PermissionsWatcher.js";
import utils from "../utils.js";

const {FwController} = WebCardinal.controllers;


export default class GenerateDIDController extends FwController {
  constructor(...props) {
    super(...props);
    if (history.state.isBack) {
      history.back();
      history.back();
      history.back();
      return;
    }

    this.model = {identity: this.history.location.state};
    window.WebCardinal.loader.hidden = true;
    this.initPermissionsWatcher = () => {
     /* getPermissionsWatcher(this.model.identity, () => {
        history.replaceState({isBack: true}, "");
        utils.showTextLoader();
        this.navigateToPageTag("home");
      });*/
    };

    this.onTagClick("copy-text", (event) => {
      copyToClipboard(event.identity);
    })
  }

}
