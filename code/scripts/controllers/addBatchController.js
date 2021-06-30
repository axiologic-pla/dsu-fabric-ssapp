const {WebcController} = WebCardinal.controllers;
import constants from "../constants.js";
import Batch from "../models/Batch.js";
import getSharedStorage from '../services/SharedDBStorageService.js';
import utils from "../utils.js";
import LogService from "../services/LogService.js";
import HolderService from "../services/HolderService.js";

const holderService = HolderService.getHolderService();

export default class addBatchController extends WebcController {
  constructor(...props) {
    super(...props);
    const epiUtils = require("epi-utils").getMappingsUtils();
    const mappings = require("epi-utils").loadApi("mappings");
    let state = this.history.location.state;
    const editMode = state != null && state.batchData != null;
    const editData = editMode ? JSON.parse(state.batchData) : undefined;
    let batch = new Batch(editData);
    this.setModel({});
    this.storageService = getSharedStorage(this.DSUStorage);
    this.logService = new LogService(this.DSUStorage);
    this.serialNumbersLogService = getSharedStorage(this.DSUStorage);
    this.versionOffset = 1;
    holderService.ensureHolderInfo((err, holderInfo) => {
      if (!err) {

        this.mappingEngine = mappings.getEPIMappingEngine(this.DSUStorage, {
          holderInfo: holderInfo,
          logService: this.logService
        });

        this.model.username = holderInfo.userDetails.username;
      } else {
        this.showErrorModalAndRedirect("Invalid configuration detected! Configure your wallet properly in the Holder section!", "batches");
      }
    })

    this.model.batch = batch;
    this.model.batch.productName = "";
    this.model.productDescription = "";
    this.model.editMode = editMode;
    this.model.serialNumbersLogs = [];
    this.model.products = {
      placeholder: "Select a product"
    }

    this.model.serial_update_options = {
      options: [
        {label: "Update Valid", value: "update-valid-serial"},
        {label: "Update Recalled", value: "update-recalled-serial"},
        {label: "Update decommissioned", value: "update-decommissioned-serial"},
        {label: "See update history", value: "update-history"}
      ],
      placeholder: "Select an option"
    }
    if (editMode) {
      this.gtin = this.model.batch.gtin;
      this.model.batch.version++;

      this.model.batch.enableExpiryDay = this.model.batch.expiry.slice(-2) !== "00";

      this.getProductFromGtin(this.gtin, (err, product) => {
        this.model.batch.productName = product.name;
        this.model.productDescription = product.description;
      });
    }

    this.serialNumbersLogService.filter(this.model.batch.batchNumber, "__timestamp > 0", (err, logs) => {
      if (err || typeof logs === "undefined") {
        logs = [];
      }
      this.model.serialNumbersLogs = logs;
    });

    this.storageService.filter(constants.PRODUCTS_TABLE, "__timestamp > 0", (err, products) => {
      if (err || !products) {
        printOpenDSUError(createOpenDSUErrorWrapper("Failed to retrieve products list!", err));
        return this.showErrorModalAndRedirect("Failed to retrieve products list! Create a product first!", "products", 5000);
      }
      const options = [];
      Object.values(products).forEach(prod => options.push({
        label: prod.gtin + ' - ' + prod.name,
        value: prod.gtin
      }));
      this.model.products.options = options;
    });

    this.model.onChange("batch.batchNumber", (event) => {
      this.serialNumbersLogService.filter(this.model.batch.batchNumber, "__timestamp > 0", (err, logs) => {
        if (err || typeof logs === "undefined") {
          logs = [];
        }
        this.model.serialNumbersLogs = logs;
      });
    })

    this.onTagClick("cancel", () => {
      this.navigateToPageTag("batches");
    });

    let addOrUpdateBatch = async () => {
      if (!this.model.batch.gtin) {
        return this.showErrorModal("Invalid product code. Please select a valid code");
      }
      let batch = this.initBatch();
      if (!batch.expiryForDisplay) {
        return this.showErrorModal("Invalid date");
      }
      // manage ignore date if day is not used we save it as last day of the month
      if (!batch.enableExpiryDay) {
          batch.expiryForDisplay = utils.getIgnoreDayDate(batch.expiryForDisplay)
      }
      batch.expiry = utils.convertDateToGS1Format(batch.expiryForDisplay, batch.enableExpiryDay);

        let error = batch.validate();
        if (error) {
          printOpenDSUError(createOpenDSUErrorWrapper("Invalid batch info", err));
          return this.showErrorModalAndRedirect("Invalid batch info" + err.message, "batches");
        }
          this.createWebcModal({
            disableExpanding: true,
            disableClosing: true,
            disableFooter: true,
            modalTitle: "Info",
            modalContent: "Saving batch..."
          });

          let message = {
            batch:{}
          }

          epiUtils.transformToMessage(batch, message.batch, epiUtils.batchDataSourceMapping);
          message.messageType ="Batch";

          try{
            console.log(message);
            let undigestedMessages = await this.mappingEngine.digestMessages([message]);
            console.log(undigestedMessages);
          }
          catch (e) {
            console.log(e);
          }

          this.hideModal();
          this.navigateToPageTag("batches");
    };

    this.onTagClick("update-batch", addOrUpdateBatch)
    this.onTagClick("add-batch", addOrUpdateBatch);


    this.model.onChange("serial_update_options.value", (event) => {
      if (this.model.serial_update_options.value === "update-history") {
        this.showSerialHistoryModal()
      } else {
        this.updateSerialsModal(this.model.serial_update_options.value);
      }
    });

    this.model.onChange("products.value", async (event) => {
      this.model.batch.gtin = this.model.products.value;
      this.getProductFromGtin(this.model.batch.gtin,(err, product)=>{
        if(err){
          printOpenDSUError(createOpenDSUErrorWrapper("Failed to get a valid product", err));
          return this.showErrorModalAndRedirect("Failed to get a valid product", "batches");
        }
        this.model.batch.gtin = product.gtin;
        this.model.batch.productName = product.name;
        this.model.productDescription = product.description || "";
        this.model.batch.product = product.keySSI
      });
    })

    this.on('openFeedback', (e) => {
      this.feedbackEmitter = e.detail;
    });
  }

  getProductFromGtin (gtin, callback){
    this.storageService.filter(constants.PRODUCTS_TABLE, `gtin == ${gtin}`, (err, products) => {
      if(err){
        printOpenDSUError(createOpenDSUErrorWrapper("Failed to get a valid product", err));
        return this.showErrorModalAndRedirect("Failed to get a valid product", "batches");
      }
      let product = products[0];
      if(!product){
        return  callback(new Error(`No product found for gtin ${gtin}`));
      }
      callback(undefined,product);
    });
  }

  initBatch() {
    let result = this.model.batch;
    result.serialNumbers = this.stringToArray(this.model.serialNumbers);
    result.recalledSerialNumbers = this.stringToArray(this.model.recalledSerialNumbers);
    result.decommissionedSerialNumbers = this.stringToArray(this.model.decommissionedSerialNumbers);
    return result;
  }

  //TODO move it to utils
  stringToArray(string){
    if(typeof string ==="undefined"){
      return [];
    }
    return string.split(/[ ,]+/).filter(v => v !== '')
  }

  showSerialHistoryModal() {
    this.showModalFromTemplate('serial-numbers-update-history', () => {
    }, () => {
      this.model.serial_update_options.value = "Select an option";
    }, {model: this.model});
  }

  updateSerialsModal(type) {
    this.model.actionModalModel = {
      title: "Enter serial numbers separated by comma",
      acceptButtonText: 'Accept',
      denyButtonText: 'Cancel',
      type: type,
      serialNumbers: "",
      resetAll: false,
      decommissionedType: false,
      reason: {
        options: [{label: "Lost", value: "lost"}, {label: "Stolen", value: "stolen"}, {
          label: "Damaged",
          value: "damaged"
        }],
        placeholder: "Select a reason"
      }
    }
    switch (type) {
      case "update-decommissioned-serial":
        this.model.actionModalModel.decommissionedType = true;
        this.model.actionModalModel.resetButtonLabel = "Reset all decommissioned serial numbers";
        break;
      case "update-recalled-serial":
        this.model.actionModalModel.resetButtonLabel = "Reset all recalled serial numbers";
        break;
      case "update-valid-serial":
        this.model.actionModalModel.resetButtonLabel = "Reset all valid serial numbers";
        break;
      default:
        return;
    }

    const serialNumbersLog = {}
    this.showModalFromTemplate('update-batch-serial-numbers', () => {
      switch (type) {
        case "update-valid-serial":
          serialNumbersLog.action = "Updated valid serial numbers list";
          serialNumbersLog.creationTime = new Date().toUTCString();
          if (this.model.actionModalModel.resetAll) {
            this.model.batch.snValidReset = true;
          }else{
            this.model.serialNumbers = this.model.actionModalModel.serialNumbers;
          }
          break
        case "update-recalled-serial":
          serialNumbersLog.creationTime = new Date().toUTCString();
          serialNumbersLog.action = "Updated recalled serial numbers list";
          if (this.model.actionModalModel.resetAll) {
            this.model.batch.snRecalledReset = true;
          }else{
            this.model.recalledSerialNumbers = this.model.actionModalModel.serialNumbers;
          }
          break
        case "update-decommissioned-serial":
          serialNumbersLog.action = "Updated decommissioned serial numbers list";
          serialNumbersLog.creationTime = new Date().toUTCString();
          if (this.model.actionModalModel.resetAll) {
            this.model.batch.snDecomReset = true;
          }else{
            this.model.decommissionedSerialNumbers = this.model.actionModalModel.serialNumbers;
            this.model.batch.decommissionReason = this.model.actionModalModel.reason.value;
          }
          break
      }
      this.model.serial_update_options.value = "Select an option";
      this.serialNumbersLogService.insertRecord(this.model.batch.batchNumber, serialNumbersLog.creationTime, serialNumbersLog, () => {
      })
    }, () => {
      this.model.serial_update_options.value = "Select an option";
    }, {model: this.model});
  }

};
