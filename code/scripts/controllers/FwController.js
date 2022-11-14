import {getCommunicationService} from "../services/CommunicationService.js";

const gtinResolver = require("gtin-resolver");

const {WebcController} = WebCardinal.controllers;

class FwController extends WebcController {
  constructor(...props) {
    super(...props);
    getCommunicationService(this.DSUStorage).waitForMessage(this, () => {
    });
  }
}

export {FwController};
