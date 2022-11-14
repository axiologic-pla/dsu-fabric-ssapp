const {FwController} = WebCardinal.controllers;

export default class DeletedAccountController extends FwController {
  constructor(...props) {
    super(...props);
    document.getElementsByTagName("body")[0].style.pointerEvents = "none";
  }
}
