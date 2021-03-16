import Utils from "./Utils.js";

export default class Batch {
  batchNumber;
  expiryForDisplay;
  version = 1;
  versionLabel = "";
  serialNumbers = "";
  recalledSerialNumbers = "";
  decomissionedSerialNumners = "";
  defaultSerialNumber = "0";
  bloomFilterSerialisation;
  bloomFilterRecalledSerialisation;
  bloomFilterDecomissionedSerialisation;
  recalled = false;
  serialCheck = false;
  incorectDateCheck = true;
  expiredDateCheck = true;
  recalledMessage = "";
  defaultMessage = "";

  constructor(batch) {
    if (typeof batch !== undefined) {
      for (let prop in batch) {
        this[prop] = batch[prop];
      }
    }
    if (!this.batchNumber) {
      this.batchNumber = Utils.generateSerialNumber(6);
    }
  }

  generateViewModel() {
    return {label: this.batchNumber, value: this.batchNumber}
  }

  validate() {
    if (!this.batchNumber) {
      return 'Batch number is mandatory field';
    }
    if (!this.expiryForDisplay) {
      return 'Expiration date is a mandatory field.';
    }
    return undefined;
  }

  addSerialNumbers(arr, bloomfilterType) {
    let bf;
    let bfSerialisation;
    switch (bloomfilterType) {
      case "validSerialNumbers":
        bf = this.getBloomFilterSerialisation(arr, this.bloomFilterSerialisation);
        this.bloomFilterSerialisation = bf.bloomFilterSerialisation();
        break
      case "recalledSerialNumbers":
        bf = this.getBloomFilterSerialisation(arr, this.bloomFilterRecalledSerialisation)
        this.bloomFilterRecalledSerialisation = bf.bloomFilterSerialisation();
        break
      case "decomissionedSerialNumbers":
        bf = this.getBloomFilterSerialisation(arr, this.bloomFilterDecomissionedSerialisation);
        this.bloomFilterDecomissionedSerialisation = bf.bloomFilterSerialisation();
        break
    }

  }

  getBloomFilterSerialisation(arr, bfSerialisation) {
    let crypto = require("opendsu").loadAPI("crypto");
    let bf;
    if (bfSerialisation) {
      bf = crypto.createBloomFilter(bfSerialisation);
    } else {
      bf = crypto.createBloomFilter({estimatedElementCount: arr.length, falsePositiveTolerance: 0.000001});
    }
    arr.forEach(sn => {
      bf.insert(sn);
    });
    return bf
  }
}
