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
  adverseReportingEnabled = true;
  antiCounterfeitingEnabled = true;
  showEPIOnBatchRecalled = false;
  showEPIOnSNRecalled = false;
  showEPIOnSNDecommissioned = false;
  showEPIOnSNUnknown = false;
  showEPIOnIncorrectExpiryDate = false;
  showEPIOnBatchExpired = true;
  practitionerInfo = "SmPC";
  pacientLeafletInfo = "Patient Information";
  imagePath;

  constructor(product) {
    if (typeof product !== undefined) {
      for (let prop in product) {
        this[prop] = product[prop];
      }
    }

    if (this.gtin === "") {
      this.gtin = '05290931025615';
    }
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
