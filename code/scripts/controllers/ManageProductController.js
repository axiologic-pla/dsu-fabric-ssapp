import Product from '../models/Product.js';
import MessagesService from '../services/MessagesService.js';
import constants from '../constants.js';
import utils from "../utils.js";
import Countries from "../models/Countries.js";


const {FwController} = WebCardinal.controllers;
const mappings = require("gtin-resolver").loadApi("mappings");
const LogService = require("gtin-resolver").loadApi("services").LogService;
const gtinResolverUtils = require("gtin-resolver").getMappingsUtils();
const arrayBufferToBase64 = gtinResolverUtils.arrayBufferToBase64;
const ModelMessageService = require("gtin-resolver").loadApi("services").ModelMessageService;
const gtinResolver = require("gtin-resolver");

export default class ManageProductController extends FwController {
  constructor(...props) {
    super(...props);
    this.model = {
      disabledFeatures: this.disabledFeatures,
      userrights: this.userRights,
      languageTypeCards: [],
      pageIsLoading: true
    };
    let state = this.history.location.state;
    this.state = state;

    this.submitButton = this.querySelector("#submit-product");
    this.cancelButton = this.querySelector("#cancel-product");
    if (state && state.gtin) {
      // product already exists, enter in edit mode

      this.submitButton.disabled = true;
      gtinResolver.DSUFabricUtils.getProductMetadata(state.gtin, (err, product) => {
        if (err) {
          return this.storageService.getRecord(constants.PRODUCTS_TABLE, state.gtin, (e, product) => {
            if (e) {
              return this.showErrorModal(`Unable to read product info from database! ${e.message}`, "Error", () => {
                this.navigateToPageTag("products");
              });
            }
            return this.handlerUnknownError(state, product);
          });
        }
        this.model.submitLabel = "Update Product";
        this.model.product = new Product(product);
        this.model.product.version = product.version;
        this.model.product.previousVersion = product.version;
        this.model.product.isCodeEditable = false;
        this.model.product.videos = product.videos || {defaultSource: ""};
        gtinResolver.DSUFabricUtils.getDSUAttachments(product, this.disabledFeatures, (err, attachments) => {
          this.model.onChange("product", (...props) => {
            this.manageUpdateButtonState(this.submitButton);
          })
          this.model.onChange("languageTypeCards", (...props) => {
            this.manageUpdateButtonState(this.submitButton);
          })

          if (err) {
            return this.handlerUnknownError(state, product);
          }

          this.model.languageTypeCards = attachments ? attachments.languageTypeCards : [];
          this.model.languageTypeCardsForDisplay = attachments ? attachments.languageTypeCards : [];
          if (attachments && attachments.productPhoto) {
            this.model.product.photo = attachments.productPhoto;
          }
          this.saveInitialState();
        });
        // ensureHolderCredential();
        this.model.product.videos.defaultSource = atob(this.model.product.videos.defaultSource);
        this.videoInitialDefaultSource = this.model.product.videos.defaultSource;
        this.validateGTIN(this.model.product.gtin);

      });
    } else {
      this.model.submitLabel = "Save Product";
      this.model.product = new Product();
      this.model.languageTypeCardsForDisplay = [];
      this.model.product.videos.defaultSource = atob(this.model.product.videos.defaultSource);
      this.videoInitialDefaultSource = this.model.product.videos.defaultSource;
      // ensureHolderCredential();
      this.validateGTIN(this.model.product.gtin);
      this.saveInitialState();

    }

    setTimeout(() => {
      this.setUpCheckboxes();
    }, 0);

    utils.disableFeatures(this);

    this.model.videoSourceUpdated = false;

    this.addEventListeners();

  }

  saveInitialState() {
    this.initialCards = JSON.parse(JSON.stringify(this.model.languageTypeCards));
    this.initialModel = JSON.parse(JSON.stringify(this.model));
    this.model.pageIsLoading = false;
  }

  handlerUnknownError(state, product) {
    this.model.pageIsLoading = false;
    if (!this.canWrite()) {
      this.showErrorModalAndRedirect("Failed to retrieve information about the selected product", "Error", {tag: "products"});
      return;
    }

    gtinResolver.DSUFabricUtils.checkIfWeHaveDataForThis(state.gtin, undefined, (err) => {
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
            let recoveryMessage = await utils.initMessage("Product");
            recoveryMessage.product = product;
            if (!recoveryMessage.product) {
              recoveryMessage.product = {
                productCode: state.gtin
              };
            }
            if (!recoveryMessage.product.productCode) {
              recoveryMessage.product.productCode = state.gtin;
            }
            if (!recoveryMessage.product.inventedName) {
              recoveryMessage.product.inventedName = product ? product.name : "recovered data";
            }
            if (!recoveryMessage.product.nameMedicinalProduct) {
              recoveryMessage.product.nameMedicinalProduct = product ? product.description : "recovered data";
            }
            recoveryMessage.force = true;
            //by setting this refreshState if all goes when we will return to edit the product
            this.refreshState = {
              tag: "home", state: {
                refreshTo: {
                  tag: "manage-product", state: {gtin: state.gtin}
                }
              }
            };
            this.sendMessagesToProcess([recoveryMessage]);
          }, 100);
        }, () => {
          console.log("Rejected the recover process by choosing no option.");
          this.showErrorModalAndRedirect("Refused the recovery process. Redirecting...", "Info", {tag: "products"});
        }, {
          disableExpanding: true, cancelButtonText: 'No', confirmButtonText: 'Yes', id: 'feedback-modal'
        })
      }

      this.showErrorModalAndRedirect("Unable to verify if data exists in Blockchain. Try later!", "Error", {tag: "products"});
      return;
    });
  }

  setUpCheckboxes() {
    let checkboxes = this.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach(checkbox => {
      checkbox.checked = checkbox.value === "true";
    })
  }

  productWasUpdated() {
    if (!(this.state && this.state.gtin)) {
      return true;
    }
    return JSON.stringify(this.model.product) !== JSON.stringify(this.initialModel.product);
  }

  manageUpdateButtonState(updateButton) {
    updateButton.disabled = JSON.stringify(this.model.languageTypeCardsForDisplay) === JSON.stringify(this.initialCards) && JSON.stringify(this.model.product) === JSON.stringify(this.initialModel.product) && !this.productPhoto;
  }

  addEventListeners() {

    this.onTagEvent("productcode-edit", constants.HTML_EVENTS.FOCUSOUT, (model, target, event) => {
      this.validateGTIN(target.value);
    })

    this.onTagClick("cancel", () => {
      this.navigateToPageTag("products");
    })

    this.onTagClick("add-market", (event) => {
      this.model.actionModalModel = {
        acceptButtonText: 'Add Market', action: "submit-add-market"
      }
      this.editMarket(event);
    })

    this.onTagClick("edit-market", (event) => {
      this.model.actionModalModel = {
        acceptButtonText: 'Update Market', action: "submit-update-market", marketId: event.marketId
      }
      this.editMarket(event);
    });

    this.onTagClick("submit-add-market", (event) => {
      this.validateMarket();
      if (!this.model.marketModel.validationFailed) {
        this.model.product.addMarket(this.model.selectedMarket);
      }
    })

    this.onTagClick("submit-update-market", (event) => {
      this.validateMarket();
      if (!this.model.marketModel.validationFailed) {
        this.model.product.updateMarket(this.model.actionModalModel.marketId, this.model.selectedMarket);
      }
    })

    this.onTagClick("remove-market", (model, event) => {
      this.model.product.removeMarket(model.marketId);
    })

    this.model.onChange('product.videos.defaultSource', async (...props) => {
      this.model.videoSourceUpdated = this.videoInitialDefaultSource !== this.model.product.videos.defaultSource;
    })

    this.querySelector(".product-photo-input").addEventListener("change", (event) => {
      let filesArray = Array.from(event.target.files);
      let allowedExtension = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp'];

      if (filesArray.length === 0) {
        return;
      }
      if (allowedExtension.indexOf(filesArray[0].type) < 0) {
        this.notificationHandler.reportUserRelevantWarning("Invalid Image Upload: The file you attempted to upload is not a valid image format or is corrupted. Please ensure you are uploading a supported image file (e.g., JPG, PNG, GIF) and that the file is not damaged.")
        return;
      }
      let reader = new FileReader();
      reader.onload = (e) => {
        let imageDataUrl = e.target.result;
        fetch(imageDataUrl).then(res => res.arrayBuffer())
          .then((imageContent) => {
            this.productPhoto = imageContent;
            this.model.product.photo = gtinResolverUtils.getImageAsBase64(imageContent);
          });
        this.src = imageDataUrl;
      };
      reader.readAsDataURL(filesArray[0]);
    })

    this.onTagClick("product-photo-selected", (model, target, event) => {
      let fileChooser = target.querySelector("input");
      fileChooser.dispatchEvent(new MouseEvent("click"));
      event.stopImmediatePropagation();

    });

    /*    this.on('openFeedback', (e) => {
          this.feedbackEmitter = e.detail;
        });*/


    this.onTagClick("add-product", async (model, target, event) => {
      let product = this.model.product.clone();
      this.toggleFormButtons(true);
      if (this.model.product.isCodeEditable) {
        //let productInDB = await $$.promisify(this.storageService.getRecord)(constants.PRODUCTS_TABLE, product.gtin);
        let productInDB;
        try {
          productInDB = await $$.promisify(this.storageService.getRecord)(constants.PRODUCTS_TABLE, product.gtin);
          if (productInDB) {
            this.notificationHandler.reportUserRelevantWarning("Product code validation failed. Provided product code is already used.")
            this.toggleFormButtons(false);
            return;
          }
        } catch (e) {
          //if gtin is not used continue with saving
        }

      }
      await this.saveProduct(product);
      this.toggleFormButtons(false);

    });
  }

  toggleFormButtons(val) {
    this.submitButton.disabled = val;
    this.cancelButton.disabled = val;
  }

  async confirmSave(product) {
    this.createWebcModal({
      disableExpanding: true,
      disableClosing: true,
      disableFooter: true,
      modalTitle: "Info",
      modalContent: `Saving product...`
    });
    let message = await utils.initMessage("Product");

    try {
      let modelMsgService = new ModelMessageService("product");
      message.product = modelMsgService.getMessageFromModel(product);
      if (!message.product.flagEnableAdverseEventReporting) {
        delete message.product.adverseEventReportingURL
      }
      if (!message.product.flagEnableACFProductCheck) {
        delete message.product.acfProductCheckURL
      }
      let photoMessages = [];
      //process photo
      if (typeof this.productPhoto !== "undefined") {
        let addPhotoMessage = await utils.initMessage("ProductPhoto");
        addPhotoMessage.productCode = message.product.productCode;
        addPhotoMessage.imageData = arrayBufferToBase64(this.productPhoto);
        photoMessages.push(addPhotoMessage);
      }

      //process leaflet & smpc cards
      let leafletMsg = await utils.initMessage("leaflet");
      leafletMsg.cards = [...this.model.languageTypeCards];
      leafletMsg.username = this.model.username;
      leafletMsg.code = message.product.productCode;
      let cardMessages = await gtinResolver.DSUFabricUtils.createEpiMessages(leafletMsg, "product");

      let messages = [];
      if (this.productWasUpdated()) {
        messages = [message, ...photoMessages, ...cardMessages];
      } else {
        messages = [...photoMessages, ...cardMessages];
      }

      if (!this.DSUStorage.directAccessEnabled) {
        this.DSUStorage.enableDirectAccess(async () => {
          this.sendMessagesToProcess(messages);
        });
      } else {
        this.sendMessagesToProcess(messages);
      }

    } catch (e) {
      this.showErrorModal(e.message);
    }
  }

  async saveProduct(product) {
    if (!this.isValid(product)) {
      return;
    }
    // show diffs just if edit product on create skip this step
    if (this.state) {
      this.model.diffs = this.getDiffs();
      this.showModalFromTemplate("view-edit-changes/template", async () => {
        await this.confirmSave(product);
      }, () => {
        return
      }, {
        disableClosing: true,
        model: this.model,
        controller: "modals/PreviewEditChangesController"
      })
    } else {
      await this.confirmSave(product);
    }

  }

  async sendMessagesToProcess(messageArr) {
    //process video source if any change for video fields in product or language cards
    if (this.model.videoSourceUpdated) {
      let videoMessage = await utils.initMessage("VideoSource");
      videoMessage.videos = {
        productCode: this.model.product.gtin
      }

      videoMessage.videos.source = btoa(this.model.product.videos.defaultSource);

      let videoSources = [];
      this.model.languageTypeCards.forEach(card => {
        if (card.videoSource) {
          videoSources.push({documentType: card.type.value, lang: card.language.value, source: card.videoSource})
        }
      })
      videoMessage.videos.sources = videoSources

      messageArr.push(videoMessage);

    }

    MessagesService.processMessagesWithoutGrouping(messageArr, MessagesService.getStorageService(this.storageService), async (err, undigestedMessages) => {
      let handler = this.getHandlerForMessageDigestingProcess(messageArr, this.prepareModalInformation);
      //managing popus ...
      await handler(err, undigestedMessages);

      this.showMessageError(undigestedMessages);
    });
  }

  prepareModalInformation(err, undigested, messages) {
    return {
      title: `There was an error during saving process. Cause: ${err.message ? err.message : ''}`,
      content: 'Saving failed'
    }
  }

  getDiffs() {
    let result = [];
    try {
      let mappingLogService = mappings.getMappingLogsInstance(this.storageService, new LogService());
      let diffs = mappingLogService.getDiffsForAudit(this.model.product, this.initialModel.product);
      let epiDiffs = mappingLogService.getDiffsForAudit(this.model.languageTypeCards, this.initialCards);
      Object.keys(diffs).forEach(key => {
        if (key === "photo") {
          result.push(utils.getPhotoDiffViewObj(diffs[key], key, constants.MODEL_LABELS_MAP.PRODUCT));
          return;
        }
        result.push(utils.getPropertyDiffViewObj(diffs[key], key, constants.MODEL_LABELS_MAP.PRODUCT));
      });
      Object.keys(epiDiffs).forEach(key => {
        result.push(utils.getEpiDiffViewObj(epiDiffs[key]));
      });

    } catch (e) {
      console.log(e);
    }

    return result
  }

  validateGTIN(gtinValue) {
    let gtinValidationResult = gtinResolver.validationUtils.validateGTIN(gtinValue);
    this.model.gtinIsValid = gtinValidationResult.isValid;
    this.model.invalidGTINMessage = gtinValidationResult.message;
  }

  showMessageError(undigestedMessages) {
    let errors = [];
    const errorMessage = "There was an error during saving process.";
    const shownErrors = [{message: errorMessage}]
    if (undigestedMessages.length > 0) {
      undigestedMessages.forEach(msg => {
        if (errors.findIndex((elem) => elem.message === msg.reason.originalMessage || elem.message === msg.reason.debug_message || elem.message === msg.reason) < 0) {
          let obj;
          if (typeof msg.reason === "object") {
            obj = msg.reason
          } else {
            obj = msg.error || {originalMessage: msg.reason};
          }
          const error = new Error(obj.originalMessage || obj.debug_message || obj.message);
          errors.push(error);
        }
      })

      console.log(errors);
      this.showModalFromTemplate("digest-messages-error-modal", () => {

        this.navigateToPageTag("products");
      }, () => {
      }, {model: {errors: shownErrors}});
    } else {
      if (this.refreshState) {
        //this.refreshState is controlled above in unknownHandler before force recovery
        this.notificationHandler.reportUserRelevantInfo("Refreshing the manage product page after recovery");
        return setTimeout(() => {
          this.navigateToPageTag(this.refreshState.tag, this.refreshState.state);
        }, 500);
      }
      this.navigateToPageTag("products");
    }
  }

  filesWereProvided() {
    return this.model.languageTypeCards.filter(lf => lf.files.length > 0).length > 0;
  }

  isValid(product) {

    let validationResult = product.validate();

    if (Array.isArray(validationResult)) {
      validationResult.forEach((err) => {
        this.notificationHandler.reportUserRelevantWarning(err);
      })
      return false;
    }

    if (!this.model.gtinIsValid) {
      this.notificationHandler.reportUserRelevantWarning("Invalid product code.")
      return false;
    }

    return true;
  }

  editMarket(event) {
    if (!this.model.product.markets) {
      this.model.product.markets = [];
    }
    let existingCountryMarketIds = this.model.product.markets.map(market => market.marketId);
    let countriesList = event.marketId ? Countries.getList().map(country => {
      return {
        label: country.name, value: country.code, selected: false
      }
    }) : Countries.getList().filter(country => !existingCountryMarketIds
      .includes(country.code)).map(country => {
      return {
        label: country.name, value: country.code, selected: false
      }
    });

    if (!event.marketId) {
      countriesList[0].selected = true;
    } else {
      let selectedCountry = countriesList.find(item => item.value === event.marketId)
      selectedCountry.selected = true;
    }

    this.model.marketModel = {
      validationFailed: false,
      countriesCodes: {
        options: countriesList,
        value: event.marketId || countriesList[0].value
      }, nationalCode: {
        value: event.nationalCode || "",
        isValid: true
      }, mahName: {
        value: event.mahName || "",
        isValid: true
      }, legalEntityName: {
        value: event.legalEntityName || "", placeholder: "Enter legal entity name", label: "",

        isValid: true
      }
    }


    this.showModalFromTemplate('add-market', () => {
    }, () => {
    }, {model: this.model});
  }

  validateMarket() {
    let market = {
      marketId: this.model.marketModel.countriesCodes.value,
      nationalCode: this.model.marketModel.nationalCode.value,
      mahName: this.model.marketModel.mahName.value,
      legalEntityName: this.model.marketModel.legalEntityName.value
    }
    let validationFailed = false;
    for (let prop in market) {
      if (this.model.marketModel[prop]) {
        if (this.model.marketModel[prop].required && market[prop].replace(/\s/g, "").length === 0) {
          validationFailed = true;
        }
        this.model.marketModel[prop].isValid = !validationFailed;
      }
    }

    if (validationFailed) {
      this.model.marketModel.validationFailed = true;
      this.notificationHandler.reportUserRelevantWarning("All fields are required.");
    } else {
      this.model.marketModel.validationFailed = false;
      this.model.selectedMarket = market;
      this.hideModal();
    }
  }
}

