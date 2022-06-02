import {getCommunicationService} from "../services/CommunicationService.js";

const {WebcController} = WebCardinal.controllers;

export default class DeletedAccountController extends WebcController {
  constructor(...props) {
    super(...props);
    getCommunicationService(this.DSUStorage).waitForMessage(this, () => {
    });
    document.getElementsByTagName("body")[0].style.pointerEvents = "none";
  }
}
