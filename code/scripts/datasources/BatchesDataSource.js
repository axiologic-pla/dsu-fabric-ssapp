import {LazyDataSource} from "./LazyDataSource.js";
import utils from "../utils.js";

const charsMap = {
  "33": "!",
  "34": '"',
  "35": "#",
  "36": "$",
  "37": "%",
  "38": "&",
  "39": "'",
  "40": "(",
  "41": ")",
  "42": "*",
  "43": "+",
  "45": "-",
  "46": ".",
  "47": "/",
  "58": ":",
  "59": ";",
  "60": "<",
  "61": "=",
  "62": ">",
  "63": "?",
  "64": "@",
  "91": "[",
  "92": "\\",
  "93": "]",
  "94": "^",
  "95": "_",
  "96": "`",
  "123": "{",
  "124": "|",
  "125": "}",
  "126": "~"
}

export default class BatchesDataSource extends LazyDataSource {
  constructor(...props) {
    super(...props);
  }

  bwipjsEscape(data) {
    let resultData = data.split("").map(char => {
      if (charsMap[char.charCodeAt(0)]) {
        return char.charCodeAt(0) >= 100 ? `^${char.charCodeAt(0)}` : `^0${char.charCodeAt(0)}`
      } else {
        return char;
      }
    }).join("")
    return resultData;
  }

  generateSerializationForBatch(batch, serialNumber) {
    if (serialNumber === "" || typeof serialNumber === "undefined") {
      return `(01)${batch.gtin}(10)${batch.batchNumber}(17)${batch.expiry}`;
    }

    return `(01)${batch.gtin}(21)${this.bwipjsEscape(serialNumber)}(10)${this.bwipjsEscape(batch.batchNumber)}(17)${batch.expiry}`;
  }

  generateSerializations(arr) {
    arr.forEach((batch) => {
      batch.code = utils.sanitizeCode(this.generateSerializationForBatch(batch, batch.defaultSerialNumber));
      if (batch.defaultRecalledSerialNumber) {
        batch.recalledCode = utils.sanitizeCode(this.generateSerializationForBatch(batch, batch.defaultRecalledSerialNumber));
      }
      if (batch.defaultDecommissionedSerialNumber) {
        batch.decommissionedCode = utils.sanitizeCode(this.generateSerializationForBatch(batch, batch.defaultDecommissionedSerialNumber));
      }
      let wrongBatch = JSON.parse(JSON.stringify(batch));
      wrongBatch.defaultSerialNumber = "WRONG";
      batch.wrongCode = utils.sanitizeCode(this.generateSerializationForBatch(wrongBatch, wrongBatch.defaultSerialNumber));
      batch.formatedDate = batch.expiry.match(/.{1,2}/g).join("/");
    });
  }

  getMappedResult(data) {
    this.generateSerializations(data);
    return data;
  }
}
