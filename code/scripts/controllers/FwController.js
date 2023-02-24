const {WebcController} = WebCardinal.controllers;

class FwController extends WebcController {
  constructor(...props) {
    super(...props);
    try {
      window.WebCardinal.loader.hidden = true;
    } catch (e) {
      // no loader to hide
    }
  }
}

export {FwController};
