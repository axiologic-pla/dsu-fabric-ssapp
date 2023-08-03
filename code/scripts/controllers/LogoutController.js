const {FwController} = WebCardinal.controllers;

export default class LogoutController extends FwController {
  constructor(...props) {
    super(...props);
    window.WebCardinal.loader.hidden = false;
    window.top.location = "/logout";
  }
}
