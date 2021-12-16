import {getCommunicationService} from "../services/CommunicationService.js";

const { WebcController } = WebCardinal.controllers;

export default class HomeController extends WebcController {
    constructor(...props) {
        super(...props);
        getCommunicationService(this.DSUStorage).waitForMessage(()=>{});
    }
}
