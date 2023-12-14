import epiUtils from "../components/epiUtils.js";
import utils from "../../utils.js";

const {FwController} = WebCardinal.controllers;
export default class PreviewEpiController extends FwController {
  constructor(element, history, ...args) {
    super(element, history, ...args);
    this.onTagClick("view-changed-value", async (model, target, event) => {
      utils.displayLoader();
      if (target.getAttribute("data-type") === "epi") {
        await this.previewEpi(model, target)
      }
      utils.hideLoader();
    })

  }

  async previewEpi(model, target) {
    let selectedEpi;
    utils.displayLoader();
    if (target.getAttribute("data-version") === "new") {
      selectedEpi = epiUtils.getSelectedEpiCard(this.model.languageTypeCards, model.newValue.value.language.value, model.newValue.value.type.value);
    } else {
      selectedEpi = model.oldValue.value;
    }

    this.showModalFromTemplate("preview-epi/template", () => {
    }, (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    }, {
      disableExpanding: true,
      disableFooter: true,
      model: await epiUtils.getPreviewModel(this.model, selectedEpi),
      controller: "modals/PreviewEpiController"
    });
    utils.hideLoader();
  };

}
