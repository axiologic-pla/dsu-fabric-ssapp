import constants from "../constants.js";
import Batch from "../models/Batch.js";
import utils from "../utils.js";
import MessagesService from "../services/MessagesService.js";
import HolderService from "../services/HolderService.js";

const {FwController} = WebCardinal.controllers;
const holderService = HolderService.getHolderService();
const gtinResolverUtils = require("gtin-resolver").getMappingsUtils();
const mappings = require("gtin-resolver").loadApi("mappings");
const LogService = require("gtin-resolver").loadApi("services").LogService;

const ModelMessageService = require("gtin-resolver").loadApi("services").ModelMessageService;
const gtinResolver = require("gtin-resolver");

export default class addBatchController extends FwController {
  constructor(...props) {
    super(...props);
    this.model = {
      disabledFeatures: this.disabledFeatures,
      userrights: this.userRights,
      languageTypeCards: [],
      products: {
        options: [{
          label: "Select a product",
          value: "",
          selected: true,
          disabled: false
        }]
      }
    };
    let state = this.history.location.state;
    const editMode = state != null && state.batchData != null;
    let editData = editMode ? JSON.parse(state.batchData) : undefined;

    if (editMode) {
      let pk = gtinResolverUtils.getBatchMetadataPK(editData.gtin, editData.batchNumber);
      gtinResolver.DSUFabricUtils.getBatchMetadata(editData.batchNumber, editData.gtin, (err, batchMetadata) => {
        if (err) {
          return this.storageService.getRecord(constants.BATCHES_STORAGE_TABLE, pk, (e, batch) => {
            if (e) {
              return this.showErrorModal(`Unable to read product info from database! ${e.message}`, "Error", () => {
                this.navigateToPageTag("batches");
              });
            }
            return this.handlerUnknownError(this.history.location.state, batch);
          });
        }

        if (batchMetadata) {
          editData = batchMetadata;
        }

        this.initialize(editMode, editData);
      });
    } else {
      this.initialize(editMode, editData);
    }
  }

  initialize(editMode, editData) {
    let batch = new Batch(editData);
    this.versionOffset = 1;
    this.model.batch = batch;
    // ACDC PATCH START
    this.model.hasAcdcAuthFeature = !!batch.acdcAuthFeatureSSI;
    // ACDC PATCH END

    this.model.batch.videos.defaultSource = atob(this.model.batch.videos.defaultSource);
    this.model.batch.productName = "";
    this.model.productDescription = "";
    this.model.editMode = editMode;
    this.model.serialNumbersLogs = [];


    this.model.serial_update_options = {
      options: [{
        label: "Update Valid",
        value: "update-valid-serial",
        selected: false,
        disabled: false
      }, {
        label: "Update Recalled",
        value: "update-recalled-serial",
        selected: false,
        disabled: false
      }, {
        label: "Update decommissioned",
        value: "update-decommissioned-serial",
        selected: false,
        disabled: false
      },
        {
          label: "See update history",
          value: "update-history",
          selected: false,
          disabled: false
        },
        {
          label: "Select an option",
          value: "",
          selected: true,
          disabled: false
        }]
    }

    this.model.videoSourceUpdated = false;
    this.videoInitialDefaultSource = this.model.batch.videos.defaultSource;
    this.initialModel = JSON.parse(JSON.stringify(this.model));
    this.initialCards = [];
    if (editMode) {
      this.gtin = this.model.batch.gtin;
      //this.model.batch.version++;
      gtinResolver.DSUFabricUtils.getDSUAttachments(this.model.batch, this.disabledFeatures, (err, attachments) => {
        if (err) {
          return this.handlerUnknownError(this.history.location.state, this.model.batch);
        }
        let submitButton = this.querySelector("#submit-batch");
        submitButton.disabled = true;
        this.model.languageTypeCards = attachments.languageTypeCards;
        this.model.languageTypeCardsForDisplay = attachments.languageTypeCards;
        this.model.batch.enableExpiryDay = this.model.batch.expiry.slice(-2) !== "00";
        this.initialCards = JSON.parse(JSON.stringify(this.model.languageTypeCards));
        this.initialModel = JSON.parse(JSON.stringify(this.model));
        this.model.onChange("batch", (...props) => {
          this.manageUpdateButtonState();
        })
        this.model.onChange("languageTypeCards", (...props) => {
          this.manageUpdateButtonState();
        })
      });


      this.getProductFromGtin(this.gtin, (err, product) => {
        this.model.batch.productName = product.name;
        this.model.productDescription = product.description;
      });

    }

    this.getNumberLogs();

    const productGtinContainer = this.element.querySelector(".product-gtin-container");
    if (editMode) {
      productGtinContainer.querySelector(".read-only-container").classList.remove("hidden");
    } else {
      productGtinContainer.querySelector(".read-write-container").classList.remove("hidden");
    }

    this.storageService.filter(constants.PRODUCTS_TABLE, "__timestamp > 0", (err, products) => {
      if (err || !products || products.length === 0) {
        this.notificationHandler.reportDevRelevantInfo("Failed to retrieve products list!", err);
        return this.showErrorModalAndRedirect("Failed to retrieve products list! Create a product first!", "Product not found", {tag: "manage-product"});
      }

      Object.values(products).forEach(prod => this.model.products.options.push({
        label: prod.gtin + ' - ' + prod.name,
        value: prod.gtin,
        selected: false,
        disabled: false
      }));

      this.addEventListeners();
      utils.disableFeatures(this);
      setTimeout(() => {
        this.setUpCheckboxes();
      }, 0)
    });


  }

  handlerUnknownError(state, batch) {
    if (!this.canWrite()) {
      this.showErrorModalAndRedirect("Failed to retrieve information about the selected batch", "Error", {tag: "batches"});
      return;
    }

    let batchData = JSON.parse(state.batchData);
    gtinResolver.DSUFabricUtils.checkIfWeHaveDataForThis(batchData.gtin, batchData.batchNumber, (err) => {
      if (!err) {
        return this.showErrorModal(new Error(`Would you like to recover?`), 'Unknown error while loading data.', async () => {
          //yes
          setTimeout(async () => {
            this.createWebcModal({
              disableExpanding: true,
              disableClosing: true,
              disableFooter: true,
              modalTitle: "Info",
              modalContent: "Recovery process in progress..."
            });

            if (typeof state.batchData === "string" && state.batchData.length > 0) {
              state.batch = JSON.parse(state.batchData);
            }

            let recoveryMessage = await utils.initMessage("Batch");
            recoveryMessage.batch = batch;
            if (!recoveryMessage.batch) {
              recoveryMessage.batch = {
                productCode: state.batch ? state.batch.gtin : undefined
              };
            }

            if (!recoveryMessage.batch.productCode) {
              recoveryMessage.batch.productCode = state.batch.gtin;
            }
            if (!recoveryMessage.batch.batch) {
              recoveryMessage.batch.batch = batch ? batch.batchNumber : "recovered data";
            }
            if (!recoveryMessage.batch.expiryDate) {
              recoveryMessage.batch.expiryDate = batch ? batch.expiry : "recovered data";
            }
            recoveryMessage.force = true;

            //by setting this refreshState if all goes when we will return to edit the product
            this.refreshState = {
              tag: "home", state: {
                refreshTo: {
                  tag: "add-batch", state: {batchData: JSON.stringify(batch)}
                }
              }
            };
            this.sendMessagesToProcess([recoveryMessage]);
          }, 100);
        }, () => {
          console.log("Rejected the recover process by choosing no option.");
          this.showErrorModalAndRedirect("Refused the recovery process. Redirecting...", "Info", {tag: "batches"});
        }, {
          disableExpanding: true, cancelButtonText: 'No', confirmButtonText: 'Yes', id: 'feedback-modal'
        })
      }
      this.showErrorModalAndRedirect("Unable to verify if data exists in Blockchain. Try later!", "Error", {tag: "batches"});
      return;
    });
  }

  async confirmSave(batch) {
    this.createWebcModal({
      disableExpanding: true,
      disableClosing: true,
      disableFooter: true,
      modalTitle: "Info",
      modalContent: "Saving batch..."
    });

    let message = await utils.initMessage("Batch");

    try {

      let modelMsgService = new ModelMessageService("batch");
      message.batch = modelMsgService.getMessageFromModel(batch);

      //process batch, leaflet & smpc cards

      let leafletMsg = await utils.initMessage("leaflet");
      leafletMsg.cards = [...this.model.languageTypeCards];
      leafletMsg.username = this.model.username;
      leafletMsg.code = message.batch.batch;
      leafletMsg.productCode = message.batch.productCode;
      let cardMessages = await gtinResolver.DSUFabricUtils.createEpiMessages(leafletMsg, "batch");
      let messages = [];
      if (this.batchWasUpdated()) {
        messages = [message, ...cardMessages];
      } else {
        messages = [...cardMessages]
      }

      await this.sendMessagesToProcess(messages);

    } catch (e) {
      this.showErrorModal(e.message);
    }
  }

  async addOrUpdateBatch(operation) {
    if (!this.model.batch.gtin) {
      return this.notificationHandler.reportUserRelevantWarning("Invalid product code. Please select a valid code");
    }
    let batch = this.initBatch();

    if (!batch.expiryForDisplay) {
      return this.notificationHandler.reportUserRelevantWarning("Invalid date");
    }
    // manage ignore date if day is not used we save it as last day of the month
    if (!batch.enableExpiryDay) {
      batch.expiryForDisplay = utils.getIgnoreDayDate(batch.expiryForDisplay)
    }
    batch.expiry = utils.convertDateToGS1Format(batch.expiryForDisplay, batch.enableExpiryDay);

    if (this.model.hasAcdcAuthFeature && !batch.acdcAuthFeatureSSI) {
      return this.notificationHandler.reportUserRelevantWarning("You have enabled Authentication Feature. Please add a value or disable it");
    }

    let error = batch.validate();

    if (error) {
      return this.notificationHandler.reportUserRelevantWarning(error, createOpenDSUErrorWrapper("Invalid batch info ", error))
    }

    if (operation === "create") {
      try {
        let batchWithIdExists = await $$.promisify(this.storageService.getRecord, this.storageService)(constants.BATCHES_STORAGE_TABLE, gtinResolverUtils.getBatchMetadataPK(this.model.batch.gtin, this.model.batch.batchNumber));
        return this.notificationHandler.reportUserRelevantWarning(`Batch ID is already in use for product with gtin ${this.model.batch.gtin}`, createOpenDSUErrorWrapper("Batch ID validation failed: ", "Batch ID is already in use"))
      } catch (e) {
        //do nothing just check if batch with batchId exists
      }
    }

    // show diffs just if edit batch on create skip this step
    if (this.model.editMode) {
      this.model.diffs = this.getDiffs();

      this.showModalFromTemplate("view-edit-changes/template", async () => {
        await this.confirmSave(batch);
      }, () => {
        return
      }, {
        disableClosing: true, model: this.model, controller: "modals/PreviewEditChangesController"
      })
    } else {
      await this.confirmSave(batch);
    }


  };

  getDiffs() {
    let result = [];
    try {
      let mappingLogService = mappings.getMappingLogsInstance(this.storageService, new LogService());
      let diffs = mappingLogService.getDiffsForAudit(this.model.batch, this.initialModel.batch);
      let epiDiffs = mappingLogService.getDiffsForAudit(this.model.languageTypeCards, this.initialCards);
      Object.keys(diffs).forEach(key => {
        if (key === "expiry") {
          return;
        }
        if (key === "expiryForDisplay") {
          let daySelectionObj = {
            oldValue: this.initialModel.batch.enableExpiryDay,
            newValue: this.model.batch.enableExpiryDay
          }

          result.push(utils.getDateDiffViewObj(diffs[key], key, daySelectionObj, constants.MODEL_LABELS_MAP.BATCH))
          return;
        }
        result.push(utils.getPropertyDiffViewObj(diffs[key], key, constants.MODEL_LABELS_MAP.BATCH));

      });
      Object.keys(epiDiffs).forEach(key => {
        result.push(utils.getEpiDiffViewObj(epiDiffs[key]));
      });

    } catch (e) {
      console.log(e);
    }

    return result
  }

  batchWasUpdated() {
    if (!this.model.editMode) {
      return true;
    }
    let serialIsUpdated = this.model.serialNumbers || this.model.recalledSerialNumbers || this.model.decommissionedSerialNumbers;
    return !(JSON.stringify(this.model.batch) === JSON.stringify(this.initialModel.batch) && !serialIsUpdated);
  }

  manageUpdateButtonState() {
    let button = this.querySelector("#submit-batch");
    if (!button || this.savingInProgress) {
      return;
    }
    let serialIsUpdated = this.model.serialNumbers || this.model.recalledSerialNumbers || this.model.decommissionedSerialNumbers;
    button.disabled = JSON.stringify(this.model.languageTypeCardsForDisplay) === JSON.stringify(this.initialCards) && JSON.stringify(this.model.batch) === JSON.stringify(this.initialModel.batch) && !serialIsUpdated;
  }

  getNumberLogs() {

    const featManager = require("gtin-resolver").DSUFabricFeatureManager;
    featManager.isFeatureEnabled("07", (err, enabled) => {
      if (enabled) {
        //await $$.promisify(this.storageService.addIndex.bind(this.storageService))(this.model.batch.batchNumber, "__timestamp");
        this.storageService.filter(this.model.batch.batchNumber, "__timestamp > 0", (err, logs) => {
          if (err || typeof logs === "undefined") {
            logs = [];
          }
          this.model.serialNumbersLogs = logs;
        });
      }
    })
  }

  addEventListeners() {
    this.model.onChange("batch.batchNumber", (event) => {
      this.getNumberLogs();
    })

    this.element.addEventListener("date-changed", (event) => {
      this.model.batch.expiryForDisplay = event.detail;
    });

    this.model.onChange("hasAcdcAuthFeature", (event) => {
      if (!this.model.hasAcdcAuthFeature) {
        this.model.batch.acdcAuthFeatureSSI = "";
      }
    })
    this.onTagClick("cancel", () => {
      this.navigateToPageTag("batches");
    });

    this.onTagClick("update-batch", async () => {
      this.toggleFormButtons(true);
      await this.addOrUpdateBatch("update");
      this.toggleFormButtons(false);

    })
    this.onTagClick("add-batch", async () => {
      this.toggleFormButtons(true);
      await this.addOrUpdateBatch("create");
      this.toggleFormButtons(false);

    })

    this.model.onChange('batch.videos.defaultSource', async (...props) => {
      this.model.videoSourceUpdated = this.videoInitialDefaultSource !== this.model.batch.videos.defaultSource;
    })

/*    this.querySelector(".custom-select select").addEventListeners("change", async (event) => {
      this.model.serial_update_options.value = event.target.value;
    });
    */
    this.model.onChange("serial_update_options.value", async (event) => {
      if (this.model.serial_update_options.value === "update-history") {
        this.showSerialHistoryModal()
      } else {
        this.updateSerialsModal(this.model.serial_update_options.value);
      }
    });

    this.model.onChange("products.value", async (event) => {
      if (!this.model.products.value) {
        return
      }
      this.model.batch.gtin = this.model.products.value;
      this.getProductFromGtin(this.model.batch.gtin, (err, product) => {
        if (err) {
          printOpenDSUError(createOpenDSUErrorWrapper("Failed to get a valid product", err));
          return this.showErrorModalAndRedirect("Failed to get a valid product", "Product not found", {tag: "batches"});
        }
        this.model.batch.gtin = product.gtin;
        this.model.batch.productName = product.name;
        this.model.productDescription = product.description || "";
        this.model.batch.product = product.keySSI
      });
    })

/*    this.on('openFeedback', (e) => {
      this.feedbackEmitter = e.detail;
    });*/
  }

  setUpCheckboxes() {
    let checkboxes = this.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach(checkbox => {
      checkbox.checked = checkbox.value === "true";
    })
  }

  async sendMessagesToProcess(messageArr) {
    //process video source if any change for video fields inproduct or language card
    if (this.model.videoSourceUpdated) {
      let videoMessage = await utils.initMessage("VideoSource");
      videoMessage.videos = {
        productCode: this.model.batch.gtin, batch: this.model.batch.batchNumber
      }

      videoMessage.videos.source = btoa(this.model.batch.videos.defaultSource);

      let videoSources = [];
      this.model.languageTypeCards.forEach(card => {
        if (card.videoSource) {
          videoSources.push({documentType: card.type.value, lang: card.language.value, source: card.videoSource})
        }
      })
      videoMessage.videos.sources = videoSources

      messageArr.push(videoMessage);

    }

    await MessagesService.processMessagesWithoutGrouping(messageArr, MessagesService.getStorageService(this.storageService), async (err, undigestedMessages) => {
      let handler = this.getHandlerForMessageDigestingProcess(messageArr, this.prepareModalInformation);
      //managing popus ...
      await handler(err, undigestedMessages);
      this.showMessageError(undigestedMessages);
      return;
    });
  }

  prepareModalInformation(err, undigested, messages) {
    return {
      title: `There was an error during saving process. Cause: ${err.message ? err.message : ''}`,
      content: 'Saving failed'
    }
  }

  showMessageError(undigestedMessages) {
    let errors = [];
    if (undigestedMessages.length > 0) {
      undigestedMessages.forEach(msg => {
        if (errors.findIndex((elem) => elem.message === msg.reason.originalMessage || elem.message === msg.reason.debug_message) < 0) {
          let obj = typeof msg.reason === "object" ? msg.reason : msg.error;
          errors.push({message: obj.originalMessage || obj.debug_message});
        }
      })

      this.showModalFromTemplate("digest-messages-error-modal", () => {
        this.hideModal();
        this.navigateToPageTag("batches");
      }, () => {
      }, {model: {errors: errors}});
    } else {
      if (this.refreshState) {
        //this.refreshState is controlled above in unknownHandler before force recovery
        console.log("Refreshing the edit batch page after recovery");
        return setTimeout(() => {
          this.navigateToPageTag(this.refreshState.tag, this.refreshState.state);
        }, 500);
      }
      this.navigateToPageTag("batches");
    }
  }

  getProductFromGtin(gtin, callback) {
    /*    this.storageService.addIndex(constants.PRODUCTS_TABLE, "gtin", (error) => {
          if (error) {
            printOpenDSUError(createOpenDSUErrorWrapper("Failed to get a valid product", error));
            return this.showErrorModalAndRedirect("Failed to get a valid product", "Product not found", {tag: "batches"});
          }*/
    this.storageService.filter(constants.PRODUCTS_TABLE, `gtin == ${gtin}`, (err, products) => {
      if (err || !products || !Array.isArray(products) || !products[0]) {
        this.notificationHandler.reportDevRelevantInfo("Failed to get a product based on provided gtin", err);
        return this.showErrorModalAndRedirect("Failed to get a product based on provided gtin", "Product not found", {tag: "batches"});
      }
      let product = products[0];
      callback(undefined, product);
    });
  }

  initBatch() {
    let result = this.model.batch;
    //removed for MVP1
    /* result.serialNumbers = this.stringToArray(this.model.serialNumbers);
     result.recalledSerialNumbers = this.stringToArray(this.model.recalledSerialNumbers);
     result.decommissionedSerialNumbers = this.stringToArray(this.model.decommissionedSerialNumbers);
 */
    return result;
  }

  //TODO move it to utils
  stringToArray(string) {
    if (typeof string === "undefined") {
      return [];
    }
    return string.split(/[ ,]+/).filter(v => v !== '')
  }

  showSerialHistoryModal() {
    this.showModalFromTemplate('serial-numbers-update-history', () => {
    }, () => {
      this.model.serial_update_options.value = "";
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
        options: [
          {label: "Lost", value: "lost", selected: false},
          {label: "Stolen", value: "stolen", selected: false},
          {label: "Damaged", value: "damaged", selected: false},
          {label: "Select a reason", value: "placeholder", selected: true}]
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

    this.showModalFromTemplate('update-batch-serial-numbers', async () => {
      switch (type) {
        case "update-valid-serial":
          serialNumbersLog.action = "Updated valid serial numbers list";
          serialNumbersLog.creationTime = new Date().toUTCString();
          if (this.model.actionModalModel.resetAll) {
            this.model.batch.snValidReset = true;
          }
          this.model.serialNumbers = this.model.actionModalModel.serialNumbers;
          break;
        case "update-recalled-serial":
          serialNumbersLog.creationTime = new Date().toUTCString();
          serialNumbersLog.action = "Updated recalled serial numbers list";
          if (this.model.actionModalModel.resetAll) {
            this.model.batch.snRecalledReset = true;
          }
          this.model.recalledSerialNumbers = this.model.actionModalModel.serialNumbers;
          break;
        case "update-decommissioned-serial":
          serialNumbersLog.action = "Updated decommissioned serial numbers list";
          serialNumbersLog.creationTime = new Date().toUTCString();
          if (this.model.actionModalModel.resetAll) {
            this.model.batch.snDecomReset = true;
          }
          this.model.decommissionedSerialNumbers = this.model.actionModalModel.serialNumbers;
          this.model.batch.decommissionReason = this.model.actionModalModel.reason.value;
          break;
      }

      this.model.serial_update_options.value = "";
      try {
        await this.storageService.safeBeginBatchAsync();
      } catch (e) {
        this.manageUpdateButtonState();
        throw e;
      }
      try {
        await $$.promisify(this.storageService.insertRecord.bind(this.storageService))(this.model.batch.batchNumber, serialNumbersLog.creationTime, serialNumbersLog);
        await this.storageService.commitBatchAsync();
      } catch (e) {
        this.manageUpdateButtonState();
        const insertError = createOpenDSUErrorWrapper(`Failed to insert serial numbers log for batch ${this.model.batch.batchNumber}`, e);
        try {
          await this.storageService.cancelBatchAsync();
        } catch (error) {
          throw createOpenDSUErrorWrapper(`Failed to cancel batch for batch ${this.model.batch.batchNumber}`, error, insertError);
        }
      }
      this.manageUpdateButtonState();
      return;
    }, () => {
      this.model.serial_update_options.value = "";
      return;
    }, {model: this.model});
  }

  toggleFormButtons(val) {
    let formButtons = this.querySelectorAll(".form-buttons psk-button");
    this.savingInProgress = val;
    if (formButtons) {
      formButtons.forEach(btn => btn.disabled = val)
    }
  }

};
