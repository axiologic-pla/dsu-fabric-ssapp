import ContainerController from "../../cardinal/controllers/base-controllers/ContainerController.js";
import constants from "../constants.js";
import Batch from "../models/Batch.js";
import SharedStorage from '../services/SharedDBStorageService.js';
import DSU_Builder from "../services/DSU_Builder.js";
import utils from "../utils.js";
import LogService from "../services/LogService.js";

const dsuBuilder = new DSU_Builder();

export default class addBatchController extends ContainerController {
    constructor(element, history) {
        super(element, history);
        let state = this.History.getState();
        const editMode = state && state.batchData;
        const editData = editMode ? JSON.parse(state.batchData) : undefined;
        let batch = new Batch(editData);
        this.setModel({});
        this.storageService = new SharedStorage(this.DSUStorage);
        this.logService = new LogService(this.DSUStorage);
        this.versionOffset = 1;
        dsuBuilder.ensureHolderInfo((err, holderInfo) => {
            if (!err) {
                this.model.username = holderInfo.userDetails.username;
            } else {
                this.showErrorModalAndRedirect("Invalid configuration detected! Configure your wallet properly in the Holder section!", "batches");
            }
        })

        this.model.batch = batch;
        this.model.editMode = editMode;
        this.model.products = {
            label: "Product",
            placeholder: "Select a product"
        }

        this.model.versions = {
            label: "Product version",
        }

        if(editMode){
      this.getVersionOptions(this.model.batch.gtin).then(result => {
        this.model.versions.options = result;
        this.model.versions.value = this.model.batch.version;
                });
            this.gtin = this.model.batch.gtin;
        }

        this.storageService.getObject(constants.PRODUCTS_TABLE, (err, products) => {
            if (err || !products) {
                printOpenDSUError(createOpenDSUErrorWrapper("Failed to retrieve products list!", err));
                return this.showErrorModalAndRedirect("Failed to retrieve products list! Create a product first!", "products", 5000);
            }
            const options = [];
            Object.keys(products).forEach(gtin => options.push({label: gtin, value: gtin}));
            this.model.products.options = options;
        });

        this.on("add-batch", () => {
      this.initBatch();
            let batch = this.model.batch;
            if (!batch.expiryForDisplay) {
                return this.showError("Invalid date");
            }
            batch.expiry = utils.convertDateToISO(batch.expiryForDisplay);
            batch.expiry = utils.convertDateFromISOToGS1Format(batch.expiry);
            this.storageService.getArray(constants.BATCHES_STORAGE_TABLE, (err, batches) => {
                /*if(err){
                    return this.showErrorModalAndRedirect("Failed to retrieve products list", "batches");
                } */
                try {
          this.addSerialNumbers(batch);
                } catch (err) {
                    return this.showError(err, "Invalid list of serial numbers");
                }

                let error = batch.validate();
                if (err) {
                    printOpenDSUError(createOpenDSUErrorWrapper("Invalid batch info", err));
                    return this.showErrorModalAndRedirect("Invalid batch info" + err.message, "batches");
                }
        if (!this.model.editMode) {
                this.displayModal("Creating new batch...");
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

    this.on("update-batch", () => {
      this.initBatch();
      let batch = this.model.batch;
      this.displayModal("Updating batch... ");
      this.updateBatchDSU(batch, (err, gtinSSI) => {
        if (err) {
          printOpenDSUError(createOpenDSUErrorWrapper("Failed to update batch DSU", err));
          return this.showErrorModalAndRedirect("Failed to update batch DSU", "batches");
        }
        this.persistBatch(batch);
        });
    })

        this.model.onChange("batch.batchNumber", (event) => {
            this.storageService.getArray(constants.BATCHES_STORAGE_TABLE, (err, batches) => {
                if (typeof batches !== "undefined" && batches !== null) {
                    this.batches = batches;
                    this.batchIndex = batches.findIndex(batch => this.model.batch.batchNumber === Object.keys(batch)[0]);
                }
            })
        })

    this.model.onChange("products.value", async (event) => {
      this.model.versions.options = await this.getVersionOptions(this.model.products.value);
      this.model.versions.value = "latest";
                this.gtin = this.model.products.value;
        })

        this.model.onChange("versions.value", (event) => {
            if (typeof this.gtin === "undefined") {
                return this.showError("A product should be selected before selecting a version");
            }

      let versionIndex;
      if (this.model.versions.value !== "latest") {
        versionIndex = parseInt(this.model.versions.value - this.versionOffset);
      } else {
        //latest version is calculated form selected product array
        //exclude batch specific versions to calculate latest version
        versionIndex = this.model.versions.options.length - this.versionOffset - 1;
        while (versionIndex >= 0 && this.selectedProduct[versionIndex].batchSpecificVersion) {
          versionIndex--
        }
      }

      if (versionIndex < 0) {
        return this.showError("All versions for this product are batch specific." +
          " Latest can not be applied, please select a batch specific version o add a new version for this product");
      }
            const product = this.selectedProduct[versionIndex];
            this.model.batch.language = product.language;
      if (this.model.versions.value === "latest") {
        this.model.batch.version = this.model.versions.value;
        this.model.batch.versionLabel = this.model.versions.value;
      } else {
        this.model.batch.version = product.version;
        this.model.batch.versionLabel = product.batchSpecificVersion ? product.version + " - (batch specific)" : product.version;
      }
            this.model.batch.gtin = product.gtin;
            this.model.batch.product = product.keySSI;
        })

        this.on('openFeedback', (e) => {
            this.feedbackEmitter = e.detail;
        });
    }

  initBatch() {
    try {
      this.DSUStorage.beginBatch();
    } catch (err) {
      reportUserRelevantError("Dropping previous user input");
      this.DSUStorage.cancelBatch((err, res) => {
        this.DSUStorage.beginBatch();
      })
    }
  }

  getVersionOptions = (gtin) => {
    return new Promise((resolve, reject) => {
      this.storageService.getObject(constants.PRODUCTS_TABLE, (err, products) => {
        if (err) {
          return reject(err)
        } else {
          this.selectedProduct = products[gtin];
          this.versionOffset = this.selectedProduct[0].version;
          const options = this.selectedProduct.map(prod => {
            let labelValue = prod.batchSpecificVersion ? " - (batch specific)" : ""
            return {label: prod.version + labelValue, value: prod.version + ""};
          });
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
        this.DSUStorage.commitBatch((err, res) => {
          if (err) {
            printOpenDSUError(createOpenDSUErrorWrapper("Failed to commit batch. Concurrency issues or other issue", err))
          }
          this.closeModal();
          this.History.navigateToPageByTag("batches");
        });
      });

    });
  }

  addSerialNumbers(batch) {
    const serialError = new Error("Error on add serial numbers");

    if (this.model.batch.serialNumbers != "") {
      this.model.batch.serialNumbersArray = this.model.batch.serialNumbers.split(/[\r\n ,]+/);
      if (this.model.batch.serialNumbersArray.length === 0 || this.model.batch.serialNumbersArray[0] === '') {
        throw serialError;
      }
      this.model.batch.defaultSerialNumber = this.model.batch.serialNumbersArray[0];
      batch.addSerialNumbers(batch.serialNumbersArray);
    } else {
      throw serialError;
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
            delete cleanBatch.defaultSerialNumber;

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
                return this.showError("GTIN, batchNumber and expiry date are mandatory");
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
        this.storageService.getArray(constants.BATCHES_STORAGE_TABLE, (err, batches) => {
            if (err) {
                // if no products file found an error will be captured here
                //todo: improve error handling here
                this.showError("Unknown error:" + err.message);
                return callback(err);
            }
            if (typeof batches === "undefined" || batches === null) {
                batches = [];
            }
            const batchIndex = batches.findIndex(elem=>elem.batchNumber === batch.batchNumber)
            if(batchIndex >= 0){
                batches[batchIndex] = batch;
            }else{
                batches.push(batch);
            }
            this.storageService.setArray(constants.BATCHES_STORAGE_TABLE, batches, callback);
        });
    }

};
