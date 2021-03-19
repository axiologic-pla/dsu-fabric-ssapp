import utils from "../utils.js";

export default class Product {
  name = "";
  gtin = "";
  photo = utils.getFetchUrl("/download/code/assets/images/default.png");
  description = "";
  leaflet = "";
  manufName = " ";
  version = 1;
  batchSpecificVersion = false;
  files = [];
  transferred = false;
  reportURL = `${window.top.location.origin}/default-report.html`;
  antiCounterfeitingURL = `${window.top.location.origin}/default-anti-counterfeiting.html`;
  isCodeEditable = true;
  show_ePI_on_batch_recalled = {
      options: [{name:"show_ePI_on_batch_recalled", label: "Yes", checked: true, value: "true"}, {name: "show_ePI_on_batch_recalled", label: "No", value: "false"}],
  };
  show_ePI_on_sn_recalled = {
    options: [{name: "show_ePI_on_sn_recalled", label: "Yes", checked: true, value: "true"}, {name: "show_ePI_on_sn_recalled", label: "No", value: "false"}],
  };
  show_ePI_on_sn_decommissioned = {
    options: [{name: "show_ePI_on_sn_decommissioned", label: "Yes", checked: true, value: "true"}, {name: "show_ePI_on_sn_decommissioned", label: "No", value: "false"}],
  };
  show_ePI_on_sn_unknown = {
    options: [{name: "show_ePI_on_sn_unknown", label: "Yes", checked: true, value: "true"}, {name: "show_ePI_on_sn_unknown", label: "No", value: "false"}],
  };
  show_ePI_on_incorect_expiry_date = {
    options: [{name: "show_ePI_on_incorect_expiry_date", label: "Yes", checked: true, value: "true"}, {name: "show_ePI_on_incorect_expiry_date", label: "No", value: "false"}],
  };
  show_ePI_on_batch_expired = {
    options: [{name: "show_ePI_on_batch_expired", label: "Yes", checked: true, value: "true"}, {name: "show_ePI_on_batch_expired", label: "No", value: "false"}],
  };
  adverseEventsReportingEnabled = false;
  antiCounterfeitingEnabled = false;


  constructor(product) {
    if (typeof product !== undefined) {
      for (let prop in product) {
        this[prop] = product[prop];
      }
    }

    if (this.gtin === "") {
      this.gtin = '05290931025615';
    }
    //if it's not first version product name and code should not be changed
    this.isCodeEditable = this.version === 1;
  }

  validate() {
    const errors = [];
    if (!this.name) {
      errors.push('Name is required.');
    }

    if (!this.gtin) {
      errors.push('GTIN is required.');
    }

    return errors.length === 0 ? true : errors;
  }

  generateViewModel() {
    return {label: this.name, value: this.gtin}
  }
}
