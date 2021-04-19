const {WebcController} = WebCardinal.controllers;
import constants from "../constants.js";
import Batch from "../models/Batch.js";
import getSharedStorage from '../services/SharedDBStorageService.js';
import DSU_Builder from "../services/DSU_Builder.js";
import utils from "../utils.js";
import LogService from "../services/LogService.js";

const dsuBuilder = new DSU_Builder();

export default class addBatchController extends WebcController {
  constructor(element, history) {
    super(element, history);
    let state = this.history.location.state;
    const editMode = state != null && state.batchData != null;
    const editData = editMode ? JSON.parse(state.batchData) : undefined;
    let batch = new Batch(editData);
    this.setModel({});
    this.storageService = getSharedStorage(this.DSUStorage);
    this.logService = new LogService(this.DSUStorage);
    // this.serialNumbersLogService = new LogService(this.DSUStorage, constants.SERIAL_NUMBERS_LOGS_TABLE);
    this.serialNumbersLogService = getSharedStorage(this.DSUStorage);
    this.versionOffset = 1;
    dsuBuilder.ensureHolderInfo((err, holderInfo) => {
      if (!err) {
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

    this.model.versions = {
      placeholder: "-"
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
      this.getVersionOptions(this.model.batch.gtin).then(result => {
        this.model.versions.options = result;
        this.model.versions.value = this.model.batch.version;
      });
      this.gtin = this.model.batch.gtin;
    }

    this.serialNumbersLogService.filter(this.model.batch.batchNumber, "__timestamp > 0", (err, logs) => {
      if (err || typeof logs === "undefined") {
        logs = [];
      }
      this.model.serialNumbersLogs = logs;
    });

    this.storageService.filter(constants.LAST_VERSION_PRODUCTS_TABLE, "__timestamp > 0", (err, products) => {
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

    this.model.onChange("batch.batchNumber",  (event) => {
      this.serialNumbersLogService.filter(this.model.batch.batchNumber, "__timestamp > 0", (err, logs) => {
        if (err || typeof logs === "undefined") {
          logs = [];
        }
        this.model.serialNumbersLogs = logs;
      });
    })

    this.onTagClick("cancel", () => {
      this.navigateToPageTag("batches");
    })
    this.onTagClick("add-batch", () => {
      if(!this.model.batch.gtin){
        return this.showErrorModal("Invalid product code. Please select a valid code");
      }
      let batch = this.initBatch();
      if (!batch.expiryForDisplay) {
        return this.showErrorModal("Invalid date");
      }
      batch.expiry = utils.convertDateToISO(batch.expiryForDisplay);
      batch.expiry = utils.convertDateFromISOToGS1Format(batch.expiry);
      this.storageService.filter(constants.BATCHES_STORAGE_TABLE, "__timestamp > 0", (err, batches) => {
        try {
          this.addSerialNumbers(batch);
        } catch (err) {
          return this.showErrorModal(err, "Invalid list of serial numbers");
        }

        let error = batch.validate();
        if (error) {
          printOpenDSUError(createOpenDSUErrorWrapper("Invalid batch info", err));
          return this.showErrorModalAndRedirect("Invalid batch info" + err.message, "batches");
        }
        if (!this.model.editMode) {
          this.createWebcModal({
            disableExpanding: true,
            disableClosing: true,
            disableFooter: true,
            modalTitle: "Info",
            modalContent: "Saving batch..."
          });
          this.buildBatchDSU(batch, (err, keySSI) => {
            if (err) {
              printOpenDSUError(createOpenDSUErrorWrapper("Batch DSU build failed.", err));
              return this.showErrorModalAndRedirect("Batch DSU build failed.", "batches");
            }
            batch.keySSI = keySSI;
            batch.creationTime = utils.convertDateTOGMTFormat(new Date());

            this.buildImmutableDSU(batch, (err, gtinSSI) => {
              if (err) {
                printOpenDSUError(createOpenDSUErrorWrapper("Failed to build immutable DSU", err));
                return this.showErrorModalAndRedirect("Failed to build immutable DSU", "batches");
              }
              this.persistBatch(batch);
            });
          });

        }
      });
    });

    this.onTagClick("update-batch", () => {
      let batch = this.initBatch();
      try {
        this.addSerialNumbers(batch);
      } catch (err) {
        return this.showErrorModal( "Invalid list of serial numbers");
      }
      this.createWebcModal({
        disableExpanding: true,
        disableClosing: true,
        disableFooter: true,
        modalTitle: "Info",
        modalContent: "Saving batch..."
      });
      this.updateBatchDSU(batch, (err, gtinSSI) => {
        if (err) {
          printOpenDSUError(createOpenDSUErrorWrapper("Failed to update batch DSU", err));
          return this.showErrorModalAndRedirect("Failed to update batch DSU", "batches");
        }
        this.persistBatch(batch);
      });
    })

    this.model.onChange("serial_update_options.value", (event) => {
      if(this.model.serial_update_options.value === "update-history"){
        this.showSerialHistoryModal()
      }else{
        this.updateSerialsModal(this.model.serial_update_options.value);
      }
    });

    this.model.onChange("products.value", async (event) => {
      this.model.versions.options = await this.getVersionOptions(this.model.products.value);
      this.model.versions.value = "latest";
      this.gtin = this.model.products.value;
    })


    this.model.onChange("versions.value", (event) => {
      if (typeof this.gtin === "undefined") {
        return this.showErrorModal("A product should be selected before selecting a version");
      }

      this.storageService.filter(constants.PRODUCTS_TABLE, "__timestamp > 0", (err, records) => {
        const versionedRecords = records.filter(record => record.gtin === this.gtin);
        let versionIndex;
        if (this.model.versions.value !== "latest") {
          versionIndex = parseInt(this.model.versions.value - this.versionOffset);
        } else {
          //latest version is calculated form selected product array
          //exclude batch specific versions to calculate latest version
          versionIndex = this.model.versions.options.length - this.versionOffset - 1;
          while (versionIndex >= 0 && versionedRecords[versionIndex].batchSpecificVersion) {
            versionIndex--
          }
        }

        if (versionIndex < 0) {
          return this.showErrorModal("All versions for this product are batch specific." +
            " Latest can not be applied, please select a batch specific version o add a new version for this product");
        }
        const product = versionedRecords[versionIndex];
        this.model.productDescription = product.description || "";
        this.model.batch.language = product.language;
        if (this.model.versions.value === "latest") {
          this.model.batch.version = this.model.versions.value;
          this.model.batch.versionLabel = this.model.versions.value;
        } else {
          this.model.batch.version = product.version;
          this.model.batch.versionLabel = product.batchSpecificVersion ? product.version + " - (batch specific)" : product.version;
        }
        this.model.batch.gtin = product.gtin;
        this.model.batch.productName = product.name;
        this.model.batch.product = product.keySSI;
      });

    })

    this.on('openFeedback', (e) => {
      this.feedbackEmitter = e.detail;
    });
  }

  initBatch() {
    try {
      this.storageService.beginBatch();
      let result = this.model.batch;
      result.serialNumbers = this.model.serialNumbers;
      result.recalledSerialNumbers = this.model.recalledSerialNumbers;
      result.decommissionedSerialNumbers = this.model.decommissionedSerialNumbers;
      return result;
    } catch (err) {
      reportUserRelevantError("Dropping previous user input");
      this.storageService.cancelBatch((err, res) => {
        this.storageService.beginBatch();
      })
    }
  }

  getVersionOptions = (gtin) => {
    return new Promise((resolve, reject) => {
      this.storageService.getRecord(constants.LAST_VERSION_PRODUCTS_TABLE, gtin, (err, product) => {
        if (err) {
          return reject(err)
        } else {
          this.versionOffset = product.initialVersion;
          const options = [];
          let labelValue = product.batchSpecificVersion ? " - (batch specific)" : ""
          for (let i = this.versionOffset; i <= product.version; i++) {
            options.push({label: i + labelValue, value: i + ""});
          }
          options.unshift({label: "latest version", value: "latest"});
          resolve(options);
        }
      });
    })
  }
  persistBatch = (batch) => {
    this.persistBatchInWallet(batch, (err) => {
      if (err) {
        printOpenDSUError(createOpenDSUErrorWrapper("Failing to store Batch keySSI!", err));
        return this.showErrorModalAndRedirect("Failing to store Batch keySSI!", "batches");
      }
      this.logService.log({
        logInfo: batch,
        username: this.model.username,
        action: this.model.editMode ? "Update Batch" : "Created Batch",
        logType: 'BATCH_LOG'
      }, () => {
        this.storageService.commitBatch((err, res) => {
          if (err) {
            printOpenDSUError(createOpenDSUErrorWrapper("Failed to commit batch. Concurrency issues or other issue", err))
          }
          this.hideModal();
          this.navigateToPageTag("batches");
        });
      });

    });
  }
  showSerialHistoryModal(){
    this.showModalFromTemplate('serial-numbers-update-history', () => {}, () => {
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
          this.model.serialNumbers = this.model.actionModalModel.serialNumbers;
          serialNumbersLog.action = "Updated valid serial numbers list";
          serialNumbersLog.creationTime = new Date().toUTCString();
          if (this.model.actionModalModel.resetAll) {
            serialNumbersLog.action = "Reset valid serial numbers list";
            this.model.batch.bloomFilterSerialisations = [];
          }
          break
        case "update-recalled-serial":
          this.model.recalledSerialNumbers = this.model.actionModalModel.serialNumbers;
          serialNumbersLog.creationTime = new Date().toUTCString();
          serialNumbersLog.action = "Updated recalled serial numbers list";
          if (this.model.actionModalModel.resetAll) {
            serialNumbersLog.action = "Reset recalled serial numbers list";
            this.model.batch.bloomFilterRecalledSerialisations = [];
          }
          break
        case "update-decommissioned-serial":
          serialNumbersLog.action = "Updated decommissioned serial numbers list";
          serialNumbersLog.creationTime = new Date().toUTCString();
          if (this.model.actionModalModel.resetAll) {
            serialNumbersLog.action = "Reset decommissioned serial numbers list";
            this.model.batch.bloomFilterDecommissionedSerialisations = [];
          }
          this.model.decommissionedSerialNumbers = this.model.actionModalModel.serialNumbers;
          this.model.batch.decommissionReason = this.model.actionModalModel.reason.value;
          break

      }
      this.model.serial_update_options.value = "Select an option";
      this.serialNumbersLogService.insertRecord(this.model.batch.batchNumber, serialNumbersLog.creationTime, serialNumbersLog, () => {
      })
    }, () => {
      this.model.serial_update_options.value = "Select an option";
    }, {model: this.model});
  }

  addSerialNumbers(batch) {
    const serialError = new Error("Error on add serial numbers");

    if (batch.serialNumbers) {
      let serialNumbersArray = batch.serialNumbers.split(/[\r\n ,]+/);
      if (serialNumbersArray.length === 0 || serialNumbersArray[0] === '') {
        throw serialError;
      }
      batch.defaultSerialNumber = serialNumbersArray[0];
      batch.addSerialNumbers(serialNumbersArray, "validSerialNumbers");
    }

    if (batch.recalledSerialNumbers) {
      let recalledSerialNumbersArray = batch.recalledSerialNumbers.split(/[\r\n ,]+/);
      if (recalledSerialNumbersArray.length === 0 || recalledSerialNumbersArray[0] === '') {
        throw serialError;
      }
      batch.defaultRecalledSerialNumber = recalledSerialNumbersArray[0];
      batch.addSerialNumbers(recalledSerialNumbersArray, "recalledSerialNumbers");
    }

    if (batch.decommissionedSerialNumbers) {
      let decommissionedSerialNumbersArray = batch.decommissionedSerialNumbers.split(/[\r\n ,]+/);
      if (decommissionedSerialNumbersArray.length === 0 || decommissionedSerialNumbersArray[0] === '') {
        throw serialError;
      }
      batch.defaultDecommissionedSerialNumber = decommissionedSerialNumbersArray[0];
      batch.addSerialNumbers(decommissionedSerialNumbersArray, "decommissionedSerialNumbers");
    }

  }

  buildBatchDSU(batch, callback) {
    dsuBuilder.getTransactionId((err, transactionId) => {
      if (err) {
        return callback(err);
      }
      this.writeDataToBatchDSU(batch, transactionId, callback);
    });
  }

  updateBatchDSU(batch, callback) {
    dsuBuilder.getTransactionId((err, transactionId) => {
      if (err) {
        return callback(err);
      }
      dsuBuilder.setKeySSI(transactionId, batch.keySSI, (err) => {
        if (err) {
          return callback(err)
        }
        this.writeDataToBatchDSU(batch, transactionId, true, callback);
      })
    });
  }

  writeDataToBatchDSU(batch, transactionId, ignoreMount, callback) {
    if (typeof ignoreMount === "function") {
      callback = ignoreMount;
      ignoreMount = false;
    }
    let cleanBatch = JSON.parse(JSON.stringify(batch));

    delete cleanBatch.serialNumbers;
    delete cleanBatch.recalledSerialNumbers;
    delete cleanBatch.decommissionedSerialNumbers;
    delete cleanBatch.defaultSerialNumber;
    delete cleanBatch.defaultRecalledSerialNumber;
    delete cleanBatch.defaultDecommissionedSerialNumber;

    dsuBuilder.addFileDataToDossier(transactionId, constants.BATCH_STORAGE_FILE, JSON.stringify(cleanBatch), (err) => {
      if (err) {
        return callback(err);
      }

      if (ignoreMount) {
        return dsuBuilder.buildDossier(transactionId, callback);
      }
      dsuBuilder.mount(transactionId, constants.PRODUCT_DSU_MOUNT_POINT, cleanBatch.product, (err) => {
        if (err) {
          return callback(err);
        }
        dsuBuilder.buildDossier(transactionId, callback);
      });
    });
  }

  buildImmutableDSU(batch, callback) {
    dsuBuilder.getTransactionId((err, transactionId) => {
      if (err) {
        return callback(err);
      }

      if (!batch.gtin || !batch.batchNumber || !batch.expiry) {
        return this.showErrorModal("GTIN, batchNumber and expiry date are mandatory");
      }
      dsuBuilder.setGtinSSI(transactionId, dsuBuilder.holderInfo.domain, dsuBuilder.holderInfo.subdomain, batch.gtin, batch.batchNumber, batch.expiry, (err) => {
        if (err) {
          return callback(err);
        }
        //TODO: derive a sReadSSI here...
        dsuBuilder.mount(transactionId, "/batch", batch.keySSI, (err) => {
          if (err) {
            return callback(err);
          }
          dsuBuilder.buildDossier(transactionId, callback);
        });
      });
    });
  }

  persistBatchInWallet(batch, callback) {
    this.storageService.getRecord(constants.BATCHES_STORAGE_TABLE, batch.batchNumber, (err, record) => {
      if (err || !record) {
        this.storageService.insertRecord(constants.BATCHES_STORAGE_TABLE, batch.batchNumber, batch, callback);
      } else {
        this.storageService.updateRecord(constants.BATCHES_STORAGE_TABLE, batch.batchNumber, batch, callback);
      }
    });
  }

};
