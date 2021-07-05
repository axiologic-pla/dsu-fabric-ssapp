const {WebcController} = WebCardinal.controllers;
import Product from '../models/Product.js';
import HolderService from '../services/HolderService.js';
import Languages from "../models/Languages.js";
import constants from '../constants.js';
import getSharedStorage from '../services/SharedDBStorageService.js';
import UploadTypes from "../models/UploadTypes.js";
import utils from "../utils.js";
import Countries from "../models/Countries.js";

const arrayBufferToBase64 = require("epi-utils").getMappingsUtils().arrayBufferToBase64;

export default class ManageProductController extends WebcController {
  constructor(...props) {
    super(...props);
    this.controllerElement = props[0];
    this.setModel({});

    const mappings = require("epi-utils").loadApi("mappings");
    const epiUtils = require("epi-utils").getMappingsUtils();
    const LogService = require("epi-utils").loadApi("services").LogService
    let logService = new LogService(this.DSUStorage);

    this.storageService = getSharedStorage(this.DSUStorage);
    this.logService = new LogService(this.DSUStorage);

    let state = this.history.location.state;
    this.gtin = typeof state !== "undefined" ? state.gtin : undefined;
    this.model.languages = {
      label: "Language",
      placeholder: "Select a language",
      options: Languages.getListAsVM()
    };

    this.model.languageTypeCards = [];

    this.onTagClick("cancel", () => {
      this.navigateToPageTag("products");
    })

    this.onTagClick("delete-language-leaflet", (model, target, event) => {
      let eventData = target.firstElementChild.innerText.split('/');
      this.model.languageTypeCards = this.model.languageTypeCards.filter(lf => !(lf.type.value === eventData[1] && lf.language.value === eventData[0]));
    });

    this.onTagClick("add-language-leaflet", (event) => {
      this.addLanguageTypeFilesListener(event)
    });

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

    const ensureHolderCredential = () => {
      const holderService = HolderService.getHolderService();
      holderService.ensureHolderInfo((err, holderInfo) => {

        if (!err && holderInfo) {
          this.model.product.manufName = holderInfo.userDetails.company;
          this.model.username = holderInfo.userDetails.username;

          this.mappingEngine = mappings.getEPIMappingEngine(this.DSUStorage, {
            holderInfo: holderInfo,
            logService: logService
          });

        } else {
          printOpenDSUError(createOpenDSUErrorWrapper("Invalid configuration detected!", err));
          this.showErrorModalAndRedirect("Invalid configuration detected! Configure your wallet properly in the Holder section!", "products");
        }
      })
    };

    if (typeof this.gtin !== "undefined") {
      this.storageService.getRecord(constants.PRODUCTS_TABLE, this.gtin, (err, product) => {
        this.model.submitLabel = "Update Product";
        this.model.product = new Product(product);
        this.model.product.version++;
        this.model.product.previousVersion = product.version;
        this.model.product.isCodeEditable = false;
        this.getProductAttachments(product, (err, attachments) => {
          if (err) {
            this.showErrorModalAndRedirect("Failed to get inherited cards", "products");
          }
          this.model.languageTypeCards = attachments.languageTypeCards;
          if (attachments.productPhoto) {
            this.model.product.photo = attachments.productPhoto;
          }
        });
        ensureHolderCredential();
      });
    } else {
      this.model.submitLabel = "Save Product";
      this.model.product = new Product();
      ensureHolderCredential();
    }

    this.on("product-photo-selected", (event) => {
      this.productPhoto = event.data;
    });

    this.on('openFeedback', (e) => {
      this.feedbackEmitter = e.detail;
    });

    this.model.onChange("product.gtin", (event) => {

    })

    this.onTagClick("add-product", async (event) => {
      let product = this.model.product.clone();

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

      let message = {
        messageType: "Product",
        senderId: this.model.username,
        product: {}
      };

      epiUtils.transformToMessage(product, message.product, epiUtils.productDataSourceMapping);

      try {
        let undigestedMessages = await this.mappingEngine.digestMessages([message]);
        console.log(undigestedMessages);
        if (undigestedMessages.length === 0) {

          //process photo

          let newPhoto = typeof this.productPhoto !== "undefined";
          if (newPhoto) {
            let addPhotoMessage = {
              messageType: "ProductPhoto",
              productCode: message.product.productCode,
              senderId: this.model.username,
              imageData: arrayBufferToBase64(this.productPhoto)
            }

            undigestedMessages = await this.mappingEngine.digestMessages([addPhotoMessage])
            console.log("Photo undigested messages", undigestedMessages);
          }

          //process leaflet & cards smpc

          let cardMessages = [];

          for (let i = 0; i < this.model.languageTypeCards.length; i++) {
            let card = this.model.languageTypeCards[i];

            if (!card.inherited) {

              let cardMessage = {
                inherited: card.inherited,
                productCode: message.product.productCode,
                language: card.language.value,
                messageType: card.type.value,
                senderId: this.model.username,
                xmlFileContent: await $$.promisify(this.getXMLFileContent.bind(this))(card.files),
                otherFilesContent: await $$.promisify(this.getOtherCardFiles.bind(this))(card.files)
              }
              cardMessages.push(cardMessage);
            }


          }
          if (cardMessages.length > 0) {
            let undigestedLeafletMessages = await this.mappingEngine.digestMessages(cardMessages);
            console.log(undigestedLeafletMessages);
          }

        } else {
          //TODO show an error?
        }

      } catch (e) {
        console.log(e);
      }
      this.hideModal();
      this.navigateToPageTag("products");

    });
  }

  getXMLFileContent(files, callback) {
    let xmlFiles = files.filter((file) => file.name.endsWith('.xml'));

    if (xmlFiles.length === 0) {
      return callback(new Error("No xml files found."))
    }
    this.getBase64FileContent(xmlFiles[0], callback)
  }

  async getOtherCardFiles(files, callback) {
    let anyOtherFiles = files.filter((file) => !file.name.endsWith('.xml'))

    let filesContent = [];
    for (let i = 0; i < anyOtherFiles.length; i++) {
      let file = anyOtherFiles[i];
      filesContent.push({
        filename: file.name,
        fileContent: await $$.promisify(this.getBase64FileContent)(file)
      })
    }
    callback(undefined, filesContent);
  }


  getBase64FileContent(file, callback) {
    let fileReader = new FileReader();

    fileReader.onload = function (evt) {
      let arrayBuffer = fileReader.result;
      let base64FileContent = arrayBufferToBase64(arrayBuffer);
      callback(undefined, base64FileContent);
    }

    fileReader.readAsArrayBuffer(file);
  }


  getImageAsBase64(imageData) {
    if (typeof imageData === "string") {
      return imageData;
    }
    if (!(imageData instanceof Uint8Array)) {
      imageData = new Uint8Array(imageData);
    }
    let base64Image = utils.bytesToBase64(imageData);
    base64Image = `data:image/png;base64, ${base64Image}`;
    return base64Image;
  }


  addLanguageTypeFilesListener(event) {
    const languages = {
      label: "Language",
      placeholder: "Select a language",
      options: Languages.getListAsVM()
    };
    const types = {
      label: "Type",
      placeholder: "Select a type",
      options: UploadTypes.getListAsVM()
    };
    this.model.modalData = {
      title: "Choose language and type of upload",
      acceptButtonText: 'Accept',
      denyButtonText: 'Cancel',
      languages: languages,
      types: types,
      product: {
        language: "en",
        type: "leaflet"
      },
      fileChooser: {
        accept: "directory",
        "event-name": "uploadLeaflet",
        label: "Upload files",
        "list-files": true,
      },
      filesWereNotSelected: true,
    }
    this.on("uploadLeaflet", (event) => {
      this.model.modalData.files = event.data;
      if (this.model.modalData.files.length > 0) {
        this.model.modalData.filesWereNotSelected = false;
      }
    });
    this.showModalFromTemplate('select-language-and-type-modal', () => {
      if (this.typeAndLanguageExist(this.model.modalData.product.language, this.model.modalData.product.type)) {
        return alert('This language and type combo already exist.');
      }
      let selectedLanguage = Languages.getListAsVM().find(lang => lang.value === this.model.modalData.product.language);
      let selectedType = UploadTypes.getListAsVM().find(type => type.value === this.model.modalData.product.type);
      let card = this.generateCard(false, selectedType.value, selectedLanguage.value);
      card.files = this.model.modalData.files;
      this.model.languageTypeCards.push(card);
    }, () => {
      return
    }, {model: this.model});
  }

  typeAndLanguageExist(language, type) {
    return this.model.languageTypeCards.findIndex(lf => lf.type.value === type && lf.language.value === language) !== -1;
  }

  filesWereProvided() {
    return this.model.languageTypeCards.filter(lf => lf.files.length > 0).length > 0;
  }

  isValid(product) {

    if (product.version === 1) {
      if (!this.filesWereProvided()) {
        this.showErrorModal("Cannot save the product because a leaflet was not provided.");
        return false;
      }
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

  getProductAttachments(product, callback) {
    const resolver = require("opendsu").loadAPI("resolver");
    resolver.loadDSU(product.keySSI, (err, productDSU) => {
      if (err) {
        return callback(err);
      }

      let languageTypeCards = [];
      //used temporarily to avoid the usage of dsu cached instances which are not up to date
      productDSU.load(err => {
        if (err) {
          return callback(err);
        }

        productDSU.listFolders("/leaflet", (err, leaflets) => {
          if (err) {
            return callback(err);
          }

          productDSU.listFolders("/smpc", (err, smpcs) => {
            if (err) {
              return callback(err);
            }
            leaflets.forEach(leafletLanguageCode => {
              languageTypeCards.push(this.generateCard(true, "leaflet", leafletLanguageCode));
            })
            smpcs.forEach(smpcLanguageCode => {
              languageTypeCards.push(this.generateCard(true, "smpc", smpcLanguageCode));
            });

            productDSU.stat(constants.PRODUCT_IMAGE_FILE, (err, stat) => {
              if (stat.type === "file") {
                productDSU.readFile(constants.PRODUCT_IMAGE_FILE, (err, data) => {
                  if (err) {
                    return callback(err);
                  }
                  let productPhoto = this.getImageAsBase64(data);
                  callback(undefined, {languageTypeCards: languageTypeCards, productPhoto: productPhoto});
                })
              } else {
                callback(undefined, {languageTypeCards: languageTypeCards});
              }
            });

          });
        });
      });
    });
  }

  generateCard(inherited, type, code) {
    let card = {
      inherited: inherited,
      type: {value: type},
      language: {value: code}
    };
    card.type.label = UploadTypes.getLanguage(type);
    card.language.label = Languages.getLanguage(code);
    return card;
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
        required: true,
        isValid: true
      },
      mahName: {
        value: event.mahName || "",
        placeholder: "Enter manufacture name",
        label: "Manufacture Name",
        required: true,
        isValid: true
      },
      legalEntityName: {
        value: event.legalEntityName || "",
        placeholder: "Enter legal entity name",
        label: "Legal Entity Name",
        required: true,
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
      if (market[prop].replace(/\s/g, "").length === 0) {
        validationFailed = true;
        this.model.marketModel[prop].isValid = false;
      } else {
        if (this.model.marketModel[prop]) {
          this.model.marketModel[prop].isValid = true;
        }
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

