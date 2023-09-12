import {copyToClipboard} from "../helpers/document-utils.js";
import utils from "../utils.js";

const {FwController} = WebCardinal.controllers;


export default class GenerateDIDController extends FwController {
  constructor(...props) {
    super(...props);
    /*
    * if trying to render this page on browser back force to go out form wallet to login page
    * */
    if (history.state.isBack) {
      history.back();
      history.back();
      history.back();
      return;
    }
    setTimeout(() => {
      utils.hideTextLoader();
    }, 100)
    this.model = {identity: this.history.location.state};
    window.WebCardinal.loader.hidden = true;
    this.initPermissionsWatcher = () => {

    };

    this.onTagClick("copy-text", (event) => {
      copyToClipboard(event.identity);
    })
  }

}
