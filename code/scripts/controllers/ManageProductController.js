const {WebcController} = WebCardinal.controllers;
import Product from '../models/Product.js';
import Languages from "../models/Languages.js";
import constants from '../constants.js';
import SharedStorage from '../services/SharedDBStorageService.js';
import DSU_Builder from '../services/DSU_Builder.js';
import UploadTypes from "../models/UploadTypes.js";
import utils from "../utils.js";
import LogService from '../services/LogService.js';
import Utils from "../models/Utils.js";

const dsuBuilder = new DSU_Builder();
const PRODUCT_STORAGE_FILE = constants.PRODUCT_STORAGE_FILE;
const PRODUCT_IMAGE_FILE = constants.PRODUCT_IMAGE_FILE;
const LEAFLET_ATTACHMENT_FILE = constants.LEAFLET_ATTACHMENT_FILE;
const SMPC_ATTACHMENT_FILE = constants.SMPC_ATTACHMENT_FILE;

export default class ManageProductController extends WebcController {
  constructor(element, history) {
    super(element, history);
    this.setModel({});
    this.storageService = new SharedStorage(this.DSUStorage);
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
      let eventDdata = target.firstElementChild.innerText.split('/');
      this.model.languageTypeCards = this.model.languageTypeCards.filter(lf => !(lf.type.value === eventDdata[1] && lf.language.value === eventDdata[0]));
    });

    this.onTagClick("add-language-leaflet", (event) => {
      this.addLanguageTypeFilesListener(event)
    });

    const ensureHolderCredential = () => {
      this.model.submitLabel = this.model.product.isCodeEditable ? "Save Product" : "Update Product";
      dsuBuilder.ensureHolderInfo((err, holderInfo) => {
        if (!err && holderInfo) {
          this.model.product.manufName = holderInfo.userDetails.company;
          this.model.username = holderInfo.userDetails.username;
        } else {
          printOpenDSUError(createOpenDSUErrorWrapper("Invalid configuration detected!", err));
          this.showErrorModalAndRedirect("Invalid configuration detected! Configure your wallet properly in the Holder section!", "products");
        }
      })
    };

    if (typeof this.gtin !== "undefined") {
      this.storageService.getRecord(constants.LAST_VERSION_PRODUCTS_TABLE, this.gtin, (err, product) => {
        this.model.product = new Product(product);
        this.model.product.photo = utils.getFetchUrl("/download/code/assets/images/default.png")
        this.model.product.version++;
        this.model.product.isCodeEditable = false;
        this.model.product.batchSpecificVersion = false;
        ensureHolderCredential();
      });
    } else {
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
      let product = this.model.product;
      try {
        this.DSUStorage.beginBatch();
      } catch (err) {
        reportUserRelevantError("Dropping previous user input");
        this.DSUStorage.cancelBatch((err, res) => {
          this.DSUStorage.beginBatch();
        })
      }
      if (await !this.isValid(product)) {
        return;
      }

      this.showModal("Creating product....");
      this.buildProductDSU(product, (err, keySSI) => {
        if (err) {
          this.hideModal();
          printOpenDSUError(createOpenDSUErrorWrapper("Product DSU build failed!", err))
          return this.showErrorModalAndRedirect("Product DSU build failed.", "products");
        }

        console.log("Product DSU KeySSI:", keySSI);
        let finish = (err) => {
          if (err) {
            this.hideModal();
            printOpenDSUError(createOpenDSUErrorWrapper("Product keySSI failed to be stored in your wallet.", err))
            return this.showErrorModalAndRedirect("Product keySSI failed to be stored in your wallet.", "products");
          }

          this.DSUStorage.commitBatch((err, res) => {
            if (err) {
              printOpenDSUError(createOpenDSUErrorWrapper("Failed to commit batch. Concurrency issues or other issue", err))
            }
              this.hideModal();
              this.navigateToPageTag("products");
          });
        }
        if (typeof product.keySSI === "undefined") {
          return this.buildConstProductDSU(product.gtin, keySSI, (err, gtinSSI) => {
            if (err) {
              this.hideModal();
              printOpenDSUError(createOpenDSUErrorWrapper("Failed to create an Immutable Product DSU!", err))
              return this.showErrorModalAndRedirect("An Immutable DSU for the current GTIN already exists!", "products");
            }

            product.keySSI = keySSI;
            console.log("ConstProductDSU GTIN_SSI:", gtinSSI);
            this.persistProduct(product, finish);
          });
        }

        this.persistProduct(product, finish);
      });
    });
  }

  cloneProductPartial(product, src, dest, callback) {
    const resolver = require("opendsu").loadAPI("resolver");
    resolver.loadDSU(product.keySSI, (err, productDsu) => {
      if (err) {
        printOpenDSUError(createOpenDSUErrorWrapper("Failed to load product dsu", err))
        return this.showErrorModalAndRedirect("Failed to load product dsu", "products");
      }
      productDsu.cloneFolder(src, dest, callback);
    })
  }

  getLastVersionProduct() {
    const productVersions = this.products[this.gtin];
    return productVersions[productVersions.length - 1];
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
        "list-files": true
      }
    }
    this.on("uploadLeaflet", (event) => {
      this.model.modalData.files = event.data;
    });
    this.showModalFromTemplate('select-language-and-type-modal', () => {
      if (this.typeAndLanguageExist(this.model.modalData.product.language, this.model.modalData.product.type)) {
        return alert('This language and type combo already exist.');
      }
      let selectedLanguage = Languages.getListAsVM().find(lang => lang.value === this.model.modalData.product.language);
      let selectedType = UploadTypes.getListAsVM().find(type => type.value === this.model.modalData.product.type);
      this.model.languageTypeCards.push({
        type: selectedType,
        language: selectedLanguage,
        files: this.model.modalData.files,
      });
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

  async isValid(product) {

    if (product.version === 1) {
      if (!this.filesWereProvided()) {
        this.showErrorModal("Cannot save the product because a leaflet was not provided.");
        return false;
      }
    } else {
      try {
        await this.addDefaultEPI(product)
      } catch (err) {
        printOpenDSUError(createOpenDSUErrorWrapper("Failed to load productdsu", err))
        return this.showErrorModalAndRedirect("Failed to load productdsu", "products");
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

  addDefaultEPI(product) {
    return new Promise((resolve, reject) => {
      this.cloneProductPartial(product, `/product/${product.version - 1}`, `/product/${product.version}`, (err) => {
        if (err) {
          return reject(err)
        }
        return resolve()
      })
    })
  }


  buildConstProductDSU(gtin, productDSUKeySSI, callback) {
    dsuBuilder.getTransactionId((err, transactionId) => {
      if (err) {
        return callback(err);
      }
      dsuBuilder.setGtinSSI(transactionId, dsuBuilder.holderInfo.domain, dsuBuilder.holderInfo.subdomain, gtin, (err) => {
        if (err) {
          return callback(err);
        }

        let keySSIInstance = productDSUKeySSI;
        if (typeof keySSIInstance === "string") {
          const keySSISpace = require("opendsu").loadAPI("keyssi");
          keySSIInstance = keySSISpace.parse(keySSIInstance);
        }
        let sReadProductKeySSI = keySSIInstance.derive();
        dsuBuilder.mount(transactionId, "/product", keySSIInstance.getIdentifier(), (err) => {
          if (err) {
            return callback(err);
          }

          //TODO: derive a sReadSSI here...
          dsuBuilder.buildDossier(transactionId, callback);
        });
      });
    });
  }

  buildProductDSU(product, callback) {
    dsuBuilder.getTransactionId((err, transactionId) => {
      if (err) {
        return callback(err);
      }

      if (product.version > 1) {
        this.updateProductDSU(transactionId, product, callback);
      } else {
        this.createProductDSU(transactionId, product, callback);
      }
    });

  }

  createProductDSU(transactionId, product, callback) {
    this.addProductFilesToDSU(transactionId, product, (err, keySSI) => {
      if (err) {
        return callback(err);
      }
      callback(undefined, keySSI);
    });
  }

  updateProductDSU(transactionId, product, callback) {
    dsuBuilder.setKeySSI(transactionId, product.keySSI, (err) => {
      if (err) {
        return callback(err);
      }

      this.addProductFilesToDSU(transactionId, product, callback);
    });
  }


  uploadFile(transactionId, filename, file, callback) {
    dsuBuilder.addFileDataToDossier(transactionId, filename, file, (err, data) => {
      if (err) {
        return callback(err);
      }
      callback(undefined, data);
    });
  }

  addProductFilesToDSU(transactionId, product, callback) {
    const basePath = '/product/' + product.version;
    product.photo = PRODUCT_IMAGE_FILE;
    product.leaflet = LEAFLET_ATTACHMENT_FILE;
    const productStorageFile = basePath + PRODUCT_STORAGE_FILE;
    dsuBuilder.addFileDataToDossier(transactionId, productStorageFile, JSON.stringify(product), (err) => {
      if (err) {
        return callback(err);
      }
      dsuBuilder.addFileDataToDossier(transactionId, basePath + product.photo, this.productPhoto, (err) => {
        if (err) {
          return callback(err);
        }

        let languageTypeCards = this.model.languageTypeCards;

        let uploadFilesForLanguageAndType = (cardIndex) => {
          let languageAndTypeCard = languageTypeCards[cardIndex];
          if (!languageAndTypeCard) {
            return dsuBuilder.buildDossier(transactionId, callback);
          }
          if (languageAndTypeCard.files.length === 0) {
            uploadFilesForLanguageAndType(cardIndex + 1)
          }

          let uploadPath = `${basePath}/${languageAndTypeCard.type.value}/${languageAndTypeCard.language.value}`;
          this.uploadAttachmentFiles(transactionId, uploadPath, languageAndTypeCard.type.value, languageAndTypeCard.files, (err, data) => {
            if (err) {
              return callback(err);
            }
            if (cardIndex < languageTypeCards.length) {
              uploadFilesForLanguageAndType(cardIndex + 1)
            } else {
              return dsuBuilder.buildDossier(transactionId, callback);
            }
          });
        }
        return uploadFilesForLanguageAndType(0)
      });
    });

  }

  uploadAttachmentFiles(transactionId, basePath, attachmentType, files, callback) {
    if (files === undefined || files === null) {
      return callback(undefined, []);
    }
    let xmlFiles = files.filter((file) => file.name.endsWith('.xml'))
    if (xmlFiles.length === 0) {
      return callback(new Error("No xml files found."))
    }
    let anyOtherFiles = files.filter((file) => !file.name.endsWith('.xml'))
    let responses = [];
    const uploadTypeConfig = {
      "leaflet": LEAFLET_ATTACHMENT_FILE,
      "smpc": SMPC_ATTACHMENT_FILE
    }

    this.uploadFile(transactionId, basePath + uploadTypeConfig[attachmentType], xmlFiles[0], (err, data) => {
      if (err) {
        return callback(err);
      }
      responses.push(data);

      let uploadFilesRecursive = (file) => {
        this.uploadFile(transactionId, basePath + "/" + file.name, file, (err, data) => {
          if (err) {
            return callback(err);
          }
          responses.push(data);
          if (anyOtherFiles.length > 0) {
            uploadFilesRecursive(anyOtherFiles.shift())
          } else {
            return callback(undefined, responses);
          }
        });
      }

      if (anyOtherFiles.length > 0) {
        return uploadFilesRecursive(anyOtherFiles.shift());
      }
      return callback(undefined, responses);
    });
  }

  persistProduct(product, callback) {
    product.gs1Data = `(01)${product.gtin}(21)${Utils.generateNumericID(12)}(10)${Utils.generateID(6)}(17)111111`;
    if (typeof this.gtin === "undefined") {
      this.gtin = product.gtin;
    }

    product.creationTime = utils.convertDateTOGMTFormat(new Date());
    this.logService.log({
      logInfo: product,
      username: this.model.username,
      action: "Created product",
      logType: 'PRODUCT_LOG'
    }, () => {
      this.storageService.insertRecord(constants.PRODUCTS_TABLE, `${this.gtin}|${product.version}`, product, () => {
        this.storageService.getRecord(constants.LAST_VERSION_PRODUCTS_TABLE, this.gtin, (err, prod) => {
          if (err || !prod) {
            product.initialVersion = product.version;
            this.storageService.insertRecord(constants.LAST_VERSION_PRODUCTS_TABLE, this.gtin, product, callback);
          } else {
            this.storageService.updateRecord(constants.LAST_VERSION_PRODUCTS_TABLE, this.gtin, product, callback);
          }
        });
      });
    });
  }
}
