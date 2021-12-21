import {getCommunicationService} from "../services/CommunicationService.js";

const {WebcController} = WebCardinal.controllers;
import getSharedStorage from "../services/SharedDBStorageService.js";
import constants from "../constants.js";
import utils from "../utils.js";
import {LazyDataSource} from "../helpers/LazyDataSource.js";
import lazyUtils from "../helpers/lazy-data-source-utils.js";

const {DataSource} = WebCardinal.dataSources;

class BatchesDataSource extends LazyDataSource {
  constructor(...props) {
    super(...props);
  }

  generateSerializationForBatch(batch, serialNumber) {
    if (serialNumber === "" || typeof serialNumber === "undefined") {
      return `(01)${batch.gtin}(10)${batch.batchNumber}(17)${batch.expiry}`;
    }

    return `(01)${batch.gtin}(21)${serialNumber}(10)${batch.batchNumber}(17)${batch.expiry}`;
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

export default class batchesController extends WebcController {
  constructor(element, history) {
    super(element, history);
    this.model = {};
    this.model.batches = [];
    this.storageService = getSharedStorage(this.DSUStorage);
    getCommunicationService(this.DSUStorage).waitForMessage(() => {
    });
    this.model.batchesDataSource = new BatchesDataSource({
      storageService: this.storageService,
      tableName: constants.BATCHES_STORAGE_TABLE,
      searchField: "gtin"
    });

    lazyUtils.attachHandlers(this, "batchesDataSource");
    this.onTagClick("view-2DMatrix", (model, target, event) => {
      let eventData = JSON.parse(target.firstElementChild.innerText);
      this.model.actionModalModel = {
        title: "2DMatrix",
        batchData: eventData,
        acceptButtonText: "Close",
      };

      this.showModalFromTemplate("modal2DMatrix", () => {
          return;
        }, () => {
          return;
        },
        {model: this.model}
      );
    });
    this.onTagClick("import-batch", (model, target, event) => {
      event.stopImmediatePropagation();
      this.navigateToPageTag("import");
    });
    this.onTagClick("add-batch", () => {
      this.navigateToPageTag("add-batch");
    });

    this.onTagClick("edit-batch", (model, target, event) => {
        let eventData = target.getAttribute("event-data");
        const batchData = this.model.batchesDataSource.dataSourceRezults.find((element) => element.batchNumber === eventData);
        this.navigateToPageTag("add-batch", {
          batchData: JSON.stringify(batchData),
        });
      },
      {capture: true}
    );
  }
}
