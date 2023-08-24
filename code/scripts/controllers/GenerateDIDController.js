import {copyToClipboard} from "../helpers/document-utils.js";
import {getPermissionsWatcher} from "../services/PermissionsWatcher.js";

const {FwController} = WebCardinal.controllers;


export default class GenerateDIDController extends FwController {
  constructor(...props) {
    super(...props);

    this.model = {identity: this.history.location.state};
    this.initPermissionsWatcher = () => {
      getPermissionsWatcher(this.model.identity, () => {
        this.navigateToPageTag("home");
      });
    };

    this.onTagClick("copy-text", (event) => {
      copyToClipboard(event.identity);
    })
  }

}
