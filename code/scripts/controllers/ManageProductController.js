import {getCommunicationService} from "../services/CommunicationService.js";
import Product from '../models/Product.js';
import MessagesService from '../services/MessagesService.js';
import constants from '../constants.js';
import getSharedStorage from '../services/SharedDBStorageService.js';
import utils from "../utils.js";
import Countries from "../models/Countries.js";


const {WebcController} = WebCardinal.controllers;
const mappings = require("gtin-resolver").loadApi("mappings");
const gtinResolverUtils = require("gtin-resolver").getMappingsUtils();
const arrayBufferToBase64 = gtinResolverUtils.arrayBufferToBase64;
const ModelMessageService = require("gtin-resolver").loadApi("services").ModelMessageService;
const gtinResolver = require("gtin-resolver");

export default class ManageProductController extends WebcController {
  constructor(...props) {
    super(...props);

    gtinResolver.DSUFabricFeatureManager.getDisabledFeatures().then(async (disabledFeatures) => {
      this.model.disabledFeatures = disabledFeatures
      this.model = {};
      getSharedStorage(async (err, storageService)=> {
        if (err) {
          throw err;
        }

        this.storageService = storageService;
        getCommunicationService(this.DSUStorage).waitForMessage(this, () => {
        });

        let state = this.history.location.state;
        this.state = state;
        this.model.languageTypeCards = [];
        this.model.userwrights = await utils.getUserWrights();
        if (state && state.gtin) {
          // product already exists, enter in edit mode
          let submitButton = this.querySelector("#submit-product");
          submitButton.disabled = true;
          this.storageService.getRecord(constants.PRODUCTS_TABLE, state.gtin, (err, product) => {
            this.model.submitLabel = "Update Product";
            this.model.product = new Product(product);
            this.model.product.version++;
            this.model.product.previousVersion = product.version;
            this.model.product.isCodeEditable = false;
            this.model.product.videos = product.videos || {defaultSource: ""};
            gtinResolver.DSUFabricUtils.getDSUAttachments(product, disabledFeatures, (err, attachments) => {
              if (err) {
                this.showErrorModalAndRedirect("Failed to get inherited cards", "products");
              }

              this.model.languageTypeCards = attachments.languageTypeCards;
              this.initialCards = JSON.parse(JSON.stringify(this.model.languageTypeCards));
              if (attachments.productPhoto) {
                this.model.product.photo = attachments.productPhoto;
              }
              this.initialCards = JSON.parse(JSON.stringify(this.model.languageTypeCards));
              this.initialModel = JSON.parse(JSON.stringify(this.model));
              this.model.onChange("product", (...props) => {
                this.manageUpdateButtonState(submitButton);
              })
              this.model.onChange("languageTypeCards", (...props) => {
                this.manageUpdateButtonState(submitButton);
              })
            });
            // ensureHolderCredential();
            this.model.product.videos.defaultSource = atob(this.model.product.videos.defaultSource);
            this.videoInitialDefaultSource = this.model.product.videos.defaultSource;
            this.validateGTIN(this.model.product.gtin);

          });
        } else {
          this.model.submitLabel = "Save Product";
          this.model.product = new Product();
          this.model.product.videos.defaultSource = atob(this.model.product.videos.defaultSource);
          this.videoInitialDefaultSource = this.model.product.videos.defaultSource;
          // ensureHolderCredential();
          this.validateGTIN(this.model.product.gtin);

        }

        setTimeout(() => {
          this.setUpCheckboxes();
        }, 0);

        utils.disableFeatures(this);

        this.model.videoSourceUpdated = false;


        this.addEventListeners();
      });
    }).catch(e => console.log("Couldn't get disabled features"))

  }

  setUpCheckboxes() {
    let checkboxes = this.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach(checkbox => {
      checkbox.checked = checkbox.value === "true";
    })
  }

  productWasUpdated(){
    if (!(this.state && this.state.gtin)) {
      return true;
    }
    return JSON.stringify(this.model.product) !== JSON.stringify(this.initialModel.product);
  }

  manageUpdateButtonState(updateButton) {
    updateButton.disabled = JSON.stringify(this.model.languageTypeCards) === JSON.stringify(this.initialCards) && JSON.stringify(this.model.product) === JSON.stringify(this.initialModel.product) && !this.productPhoto;
  }

  addEventListeners() {
    this.onTagEvent("productcode-edit", "focusout", (model, target, event) => {
      this.validateGTIN(target.value);
    })

    this.onTagClick("cancel", () => {
      this.navigateToPageTag("products");
    })

    this.onTagClick("add-market", (event) => {
      this.model.actionModalModel = {
        acceptButtonText: 'Add Market',
        action: "submit-add-market"
      }
      this.editMarket(event);
    })

    this.onTagClick("edit-market", (event) => {
      this.model.actionModalModel = {
        acceptButtonText: 'Update Market',
        action: "submit-update-market",
        marketId: event.marketId
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

    this.on("product-photo-selected", (event) => {
      this.productPhoto = event.data;
      let submitButton = this.querySelector("#submit-product");
      submitButton.disabled = false;
    });

    this.on('openFeedback', (e) => {
      this.feedbackEmitter = e.detail;
    });

    this.onTagClick("add-product", async (event) => {
      let product = this.model.product.clone();
      if (this.model.product.isCodeEditable) {
        this.storageService.getRecord(constants.PRODUCTS_TABLE, product.gtin, async (err, productInDB) => {
          if (productInDB) {
            this.showErrorModal("Cannot save the product because provided product code is already used.");
            return;
          }
          await this.saveProduct(product);
        })
      } else {
        await this.saveProduct(product);
      }
    });
  }

  async saveProduct(product) {
    if (!this.isValid(product)) {
      return;
    }

    this.createWebcModal({
      disableExpanding: true,
      disableClosing: true,
      disableFooter: true,
      modalTitle: "Info",
      modalContent: "Saving product..."
    });

    let message = await utils.initMessage("Product");

    try {
      let modelMsgService = new ModelMessageService("product");
      message.product = modelMsgService.getMessageFromModel(product);

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
      leafletMsg.cards = [...this.model.deletedLanguageTypeCards, ...this.model.languageTypeCards];
      leafletMsg.type = "product";
      leafletMsg.username = this.model.username;
      leafletMsg.code = message.product.productCode;
      let cardMessages = await gtinResolver.DSUFabricUtils.createEpiMessages(leafletMsg);

      let messages = [];
      if (this.productWasUpdated()) {
        messages = [message, ...photoMessages, ...cardMessages];
      }else{
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

  async sendMessagesToProcess(messageArr) {
    //process video source if any change for video fields in product or language cards
    if (this.model.videoSourceUpdated) {
      let videoMessage = await utils.initMessage("VideoSource");
      videoMessage.videos = {
        productCode: this.model.product.gtin,
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

    MessagesService.processMessages(messageArr, this.DSUStorage, async (undigestedMessages) => {
      this.hideModal();
      this.showMessageError(undigestedMessages);
    })

  }

  validateGTIN(gtinValue) {
    let gtinValidationResult = gtinResolver.validationUtils.validateGTIN(gtinValue);
    this.model.gtinIsValid = gtinValidationResult.isValid;
    this.model.invalidGTINMessage = gtinValidationResult.message;
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

        this.navigateToPageTag("products");
      }, () => {

      }, {model: {errors: errors}});
    } else {

      this.navigateToPageTag("products");
    }
  }

  filesWereProvided() {
    return this.model.languageTypeCards.filter(lf => lf.files.length > 0).length > 0;
  }

  isValid(product) {
    if (!this.model.gtinIsValid) {
      this.showErrorModal("Invalid GTIN.");
      return false;
    }
    let validationResult = product.validate();
    if (Array.isArray(validationResult)) {
      for (let i = 0; i < validationResult.length; i++) {
        let err = validationResult[i];
        this.showErrorModal(err);
      }
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
          label: country.name,
          value: country.code
        }
      }) :
      Countries.getList().filter(country => !existingCountryMarketIds
        .includes(country.code)).map(country => {
        return {
          label: country.name,
          value: country.code
        }
      });

    this.model.marketModel = {
      validationFailed: false,
      countriesCodes: {
        options: countriesList,
        value: event.marketId || countriesList[0].value,
        label: "Select Country"
      },
      nationalCode: {
        value: event.nationalCode || "",
        placeholder: "Enter national code",
        label: "National Code",

        isValid: true
      },
      mahName: {
        value: event.mahName || "",
        placeholder: "Enter MAH name",
        label: "MAH Name",

        isValid: true
      },
      legalEntityName: {
        value: event.legalEntityName || "",
        placeholder: "Enter legal entity name",
        label: "Legal Entity Name",

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
    } else {
      this.model.marketModel.validationFailed = false;
      this.model.selectedMarket = market;
      this.hideModal();
    }
  }
}

