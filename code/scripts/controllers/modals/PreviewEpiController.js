const {FwController} = WebCardinal.controllers;
const gtinResolver = require("gtin-resolver");
const XMLDisplayService = gtinResolver.XMLDisplayService;
export default class PreviewEpiController extends FwController {
  constructor(element, history, ...args) {
    super(element, history, ...args);
    try {
      this.showXML(this.model.epiData);
    } catch (e) {
      this.element.dispatchEvent(new Event('closed'));
      return this.notificationHandler.reportUserRelevantError("Could not render proper content for the EPI", e);
    }

  }

  showXML(epiData) {
    let xmlService = new XMLDisplayService(this.element);
    xmlService.displayXmlContent("", epiData.xmlContent, epiData.leafletImages);
    xmlService.activateLeafletAccordion();
  }
}

