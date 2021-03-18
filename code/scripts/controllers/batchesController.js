import ContainerController from "../../cardinal/controllers/base-controllers/ContainerController.js";
import SharedStorage from '../services/SharedDBStorageService.js';
import constants from "../constants.js";
import utils from "../utils.js";

export default class batchesController extends ContainerController {
  constructor(element, history) {
    super(element, history);
    this.setModel({});
    this.storageService = new SharedStorage(this.DSUStorage);

    this.storageService.getArray(constants.BATCHES_STORAGE_TABLE, (err, batches) => {
      batches.forEach((batch) => {
        batch.code = this.generateSerializationForBatch(batch, batch.defaultSerialNumber);
        if (batch.defaultRecalledSerialNumber) {
          batch.recalledCode = this.generateSerializationForBatch(batch, batch.defaultRecalledSerialNumber);
        }
        if (batch.defaultDecommissionedSerialNumber) {
          batch.decommissionedCode = this.generateSerializationForBatch(batch, batch.defaultDecommissionedSerialNumber);
        }
        let wrongBatch = JSON.parse(JSON.stringify(batch));
        wrongBatch.defaultSerialNumber = "WRONG";
        batch.wrongCode = this.generateSerializationForBatch(wrongBatch, wrongBatch.defaultSerialNumber);
        batch.formatedDate = utils.convertDateFromISOToGS1Format(batch.expiryForDisplay, "/");
      });
      this.model.batches = batches;
    });

    this.on("sort-data", (event) => {
      let activeSortButtons = this.element.querySelectorAll('.icon-button.active')

      if (activeSortButtons.length > 0) {
        activeSortButtons.forEach(elem => {
          elem.classList.remove("active");
        })
      }
      let sortCriteria = JSON.parse(event.data)
      this.model.batches.sort(utils.sortByProperty(sortCriteria.property, sortCriteria.direction));
    });

    this.on("view-2DMatrix", (event) => {
      let actionModalModel = {
        title: "2DMatrix",
        batchData: event.data,
      }

      this.showModal('show2DMatrix', actionModalModel, (err, response) => {
        if (err || response === undefined) {
          return;
        }

      });
    });

    this.on("add-batch", () => {
      this.History.navigateToPageByTag("add-batch");
    });

    this.on('edit-batch', (event) => {
      const batchData = this.model.batches.find(element => element.batchNumber === event.data);
      this.History.navigateToPageByTag("add-batch", {'batchData': JSON.stringify(batchData)});
    }, {capture: true});
  }

  generateSerializationForBatch(batch, serialNumber) {
    if (serialNumber === '' || typeof serialNumber === "undefined") {
      return `(01)${batch.gtin}(10)${batch.batchNumber}(17)${batch.expiry}`
    }

    return `(01)${batch.gtin}(21)${serialNumber}(10)${batch.batchNumber}(17)${batch.expiry}`;
  }
}
