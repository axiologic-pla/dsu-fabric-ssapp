const gtinResolver = require("gtin-resolver");
const LeafletService = gtinResolver.DSUFabricUtils;
const Languages = gtinResolver.Languages
const UploadTypes = gtinResolver.UploadTypes
const {FwController} = WebCardinal.controllers;

const utils = gtinResolver.utils


export default class EpiComponentController extends FwController {

  constructor(...props) {
    super(...props);
    this.onTagClick("add-language-leaflet", (event) => {
      this.addLanguageTypeFilesListener(event)
    });

    this.onTagClick("delete-language-leaflet", (model, target, event) => {
      let eventData = target.firstElementChild.innerText.split('/');
      let cardIndex = this.gettypeAndLanguageIndex(eventData[0], eventData[1]);
      this.model.languageTypeCards[cardIndex].action = LeafletService.LEAFLET_CARD_STATUS.DELETE;
      if (this.model.languageTypeCards[cardIndex].videoSource) {
        this.model.videoSourceUpdated = true;
      }
      this.updateCardsForDisplay();
    });


    this.onTagClick("preview-epi", async (model, target, event) => {
      this.model.previewModalTitle = `Preview ${model.language.label} ${model.type.label}`;

      let productName;
      let productDescription;
      if (this.model.batch) {
        productName = this.model.batch.productName;
        productDescription = this.model.productDescription;
      } else {
        productName = this.model.product.name;
        productDescription = this.model.product.description;
      }
      productName = productName || "Brand/invented name is empty";
      productDescription = productDescription || "Name of Medicinal Product is empty";

      try {
        let {xmlContent, leafletImages} = await this.getEpiContent(model);
        this.model.epiData = {xmlContent, leafletImages, productName, productDescription};
      } catch (e) {
        return this.notificationHandler.reportUserRelevantError("Could not get data form EPI files", e);
      }

      this.showModalFromTemplate("preview-epi/template", () => {
      }, () => {
      }, {disableExpanding: true, disableFooter: true, model: this.model, controller: "modals/PreviewEpiController"})

    })
  }

  async getEpiContent(model) {
    let cardIndex = this.gettypeAndLanguageIndex(model.language.value, model.type.value);
    let selectedLeafletCard = this.model.languageTypeCards[cardIndex];
    let xmlContent;
    let leafletImages = {};
    for (let file of selectedLeafletCard.files) {
      if (typeof file !== "object") {
        //TODO create a service to get leaflet content and unify with get-leaflet api endpoint
        let fileContent = await LeafletService.getLeafletFile(selectedLeafletCard.type.value, selectedLeafletCard.language.value, file, this.model);
        if (file.endsWith('.xml')) {
          xmlContent = fileContent.toString();
        } else {
          leafletImages[file] = utils.getImageAsBase64(fileContent)
        }
      } else {
        if (file.name.endsWith('.xml')) {
          xmlContent = await LeafletService.getFileContent(file);
        } else {
          let fileContent = await LeafletService.getFileContentAsBuffer(file);
          leafletImages[file.name] = utils.getImageAsBase64(fileContent);
        }
      }
    }
    return {xmlContent, leafletImages}
  }


  addLanguageTypeFilesListener(event) {
    let disabledFeatures = this.model.disabledFeatures.map(feature => {
      if (feature === "01") {
        return "leaflet"
      }
      if (feature === "04") {
        return "smpc"
      }
    })
    const languages = {
      label: "Language", placeholder: "Select a language", options: Languages.getListAsVM()
    };
    const types = {
      componentLabel: "Type", placeholder: "Select a type", options: UploadTypes.getListAsVM(disabledFeatures)
    };
    this.model.modalData = {
      title: "Choose language and type of upload",
      acceptButtonText: 'Accept',
      denyButtonText: 'Cancel',
      languages: languages,
      types: types,
      videoDisabled: this.model.disabledFeatures.find(item => item.trim() === "05"),
      product: {
        language: "en", type: "leaflet", videoSource: ""
      },
      fileChooser: {
        accept: "directory", "event-name": "uploadLeaflet", label: "Upload files", "list-files": true
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
      const select = document.getElementsByClassName('document-type-select')[0];
      let selectedType = select.options[select.selectedIndex].value;
      let selectedLanguage = Languages.getListAsVM().find(lang => lang.value === this.model.modalData.product.language);
      let leafletAction;
      let cardIndex = this.gettypeAndLanguageIndex(selectedLanguage.value, selectedType);
      if (cardIndex !== -1) {
        if (this.model.languageTypeCards[cardIndex].action !== LeafletService.LEAFLET_CARD_STATUS.DELETE) {
          alert(`You are about to update an existing leaflet for ${selectedLanguage.label} language`);
        }
        leafletAction = LeafletService.LEAFLET_CARD_STATUS.UPDATE;
        //  this.model.languageTypeCards.splice(cardIndex, 1);
        this.model.languageTypeCards = this.model.languageTypeCards.filter(card => card.type.value !== selectedType || card.language.value !== selectedLanguage.value);
      } else {
        leafletAction = LeafletService.LEAFLET_CARD_STATUS.NEW
      }


      let videoSource = btoa(this.model.modalData.product.videoSource);
      let card = LeafletService.generateCard(leafletAction, selectedType, selectedLanguage.value, this.model.modalData.files, videoSource);

      this.model.languageTypeCards.push(card);
      if (videoSource) {
        this.model.videoSourceUpdated = true;
      }
      this.updateCardsForDisplay();
    }, () => {
      return
    }, {model: this.model});
  }


  gettypeAndLanguageIndex(language, type) {
    return this.model.languageTypeCards.findIndex(lf => lf.type.value === type && lf.language.value === language)
  }

  updateCardsForDisplay() {
    this.model.languageTypeCardsForDisplay = this.model.languageTypeCards.filter(card => card.action !== LeafletService.LEAFLET_CARD_STATUS.DELETE)

  }


}

