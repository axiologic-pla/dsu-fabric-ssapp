const {WebcController} = WebCardinal.controllers;
import Product from '../models/Product.js';
import HolderService from '../services/HolderService.js';
import Languages from "../models/Languages.js";
import constants from '../constants.js';
import getSharedStorage from '../services/SharedDBStorageService.js';
import UploadTypes from "../models/UploadTypes.js";
import utils from "../utils.js";
const arrayBufferToBase64 = require("epi-utils").getMappingsUtils().arrayBufferToBase64;

export default class ManageProductController extends WebcController {
  constructor(...props) {
    super(...props);
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
      let eventDdata = target.firstElementChild.innerText.split('/');
      this.model.languageTypeCards = this.model.languageTypeCards.filter(lf => !(lf.type.value === eventDdata[1] && lf.language.value === eventDdata[0]));
    });

    this.onTagClick("add-language-leaflet", (event) => {
      this.addLanguageTypeFilesListener(event)
    });

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
      this.storageService.getRecord(constants.LAST_VERSION_PRODUCTS_TABLE, this.gtin, (err, product) => {
        this.model.submitLabel = "Update Product";
        this.model.product = new Product(product);
        this.model.product.version++;
        this.model.product.previousVersion = product.version;
        this.model.product.isCodeEditable = false;
        this.model.product.batchSpecificVersion = false;
        this.getInheritedCards(product, product.version, (err, inheritedCards) => {
          if (err) {
            this.showErrorModalAndRedirect("Failed to get inherited cards", "products");
          }
          this.model.languageTypeCards = inheritedCards;
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

      product.photo =  this.getImageAsBase64(this.productPhoto||this.model.product.photo);

      let message = {
        messageType:"Product",
        product:{}
      };

      let productPropsMapping= epiUtils.productDataSourceMapping;

      for(let prop in product){
        if(typeof productPropsMapping[prop] !== "undefined"){
          message.product[productPropsMapping[prop]] = product[prop];
        }
        else{
          message.product[prop] = product[prop];
        }
      }
      message.product.photo = product.photo;

      try{
        let undigestedMessages = await this.mappingEngine.digestMessages([message]);
        console.log(undigestedMessages);
        if(undigestedMessages.length === 0){

          //process photo

          let newPhoto = typeof this.productPhoto !== "undefined";

          let addPhotoMessage = {
            inherited: !newPhoto,
            messageType: "ProductPhoto",
            productCode: message.product.productCode,
            senderId: this.model.username,
          }
          if (newPhoto) {
            addPhotoMessage.imageData = arrayBufferToBase64(this.productPhoto);
          }

          undigestedMessages = await this.mappingEngine.digestMessages([addPhotoMessage])
          console.log("Photo undigested messages", undigestedMessages);

          //process leaflet & cards smpc

          let cardMessages = [];

          for (let i = 0; i < this.model.languageTypeCards.length; i++) {
            let card = this.model.languageTypeCards[i];
            let cardMessage = {
              inherited:card.inherited,
              productCode: message.product.productCode,
              language: card.language.value,
              messageType: card.type.value
            }

            if (!card.inherited) {
              cardMessage.xmlFileContent = await $$.promisify(this.getXMLFileContent.bind(this))(card.files);
              cardMessage.otherFilesContent = await $$.promisify(this.getOtherCardFiles.bind(this))(card.files)
            }

            cardMessages.push(cardMessage);
          }
          let undigestedLeafletMessages = await this.mappingEngine.digestMessages(cardMessages);
          console.log(undigestedLeafletMessages);

        }
        else{
          //show an error?
        }

      }
      catch (e){
        console.log(e);
      }
      this.hideModal();
      this.navigateToPageTag("products");

    });
  }

  getXMLFileContent(files, callback){
    let xmlFiles = files.filter((file) => file.name.endsWith('.xml'));

    if (xmlFiles.length === 0) {
      return callback(new Error("No xml files found."))
    }
    this.getBase64FileContent(xmlFiles[0],callback)
  }

  async getOtherCardFiles(files, callback){
    let anyOtherFiles = files.filter((file) => !file.name.endsWith('.xml'))

    let filesContent = [];
    for(let i = 0; i<anyOtherFiles.length; i++){
      let file = anyOtherFiles[i];
      filesContent.push({
        filename:file.name,
        fileContent: await $$.promisify(this.getBase64FileContent)(file)
      })
    }
    callback(undefined,filesContent);
  }


  getBase64FileContent(file, callback){
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

  getInheritedCards(product, version, callback){
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

        productDSU.listFolders(this.getPathToLeaflet(version), (err, leaflets) => {
          if (err) {
            return callback(err);
          }

          productDSU.listFolders(this.getPathToSmPC(version), (err, smpcs) => {
            if (err) {
              return callback(err);
            }
            leaflets.forEach(leafletLanguageCode => {
              languageTypeCards.push(this.generateCard(true, "leaflet", leafletLanguageCode));
            })
            smpcs.forEach(smpcLanguageCode => {
              languageTypeCards.push(this.generateCard(true, "smpc", smpcLanguageCode));
            });

            callback(undefined, languageTypeCards);
          });
        });
      });
    });
  }

  generateCard(inherited, type, code){
    let card = {
      inherited: inherited,
      type: {value: type},
      language: {value: code}
    };
    card.type.label = UploadTypes.getLanguage(type);
    card.language.label = Languages.getLanguage(code);
    return card;
  }

  getPathToLeaflet(version){
    return `${this.getPathToVersion(version)}/leaflet`;
  }

  getPathToSmPC(version){
    return `${this.getPathToVersion(version)}/smpc`;
  }

  getPathToVersion(version){
    return `/product/${version}`;
  }

  getAttachmentPath(version, attachmentType, language){
    return `${this.getPathToVersion(version)}/${attachmentType}/${language}`;
  }
}
