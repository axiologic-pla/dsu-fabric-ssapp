const {FwController} = WebCardinal.controllers;
export default class SelectController extends FwController {
  constructor(...props) {
    super(...props);
    this.model.options = this.model.options ? this.model.options : [];
    this.model.options.forEach(option => {
      if (typeof option.disabled === 'undefined') {
        option.disabled = false;
      }
      if (typeof option.selected !== 'undefined' && option.selected) {
        this.model.value = option.value
      }
    })
    this.element.querySelector("select.df-select").addEventListener("change", (event) => {
      this.model.value = event.target.value;
    })
  }

}
