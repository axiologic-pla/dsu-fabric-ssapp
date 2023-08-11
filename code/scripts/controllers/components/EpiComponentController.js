const gtinResolver = require("gtin-resolver");
const LeafletService = gtinResolver.DSUFabricUtils;
const Languages = gtinResolver.Languages
const UploadTypes = gtinResolver.UploadTypes
const {FwController} = WebCardinal.controllers;
const XMLDisplayService = gtinResolver.XMLDisplayService;

import epiUtils from "./epiUtils.js";
import utils from "./../../utils.js"


export default class EpiComponentController extends FwController {

  constructor(...props) {
    super(...props);
    this.model.filesChooser = {
      accept: "directory",
      uploadedFiles: [],
      label: "Upload files",
      "list-files": true
    };

    this.onTagClick("add-language-leaflet", (event) => {
      this.addLanguageTypeFilesListener(event)
    });

    this.model.onChange("filesChooser.uploadedFiles", async (event) => {
      this.uploadedFiles = this.model.filesChooser.uploadedFiles || [];
      if (this.uploadedFiles.length > 0) {
        let selectedEpi = epiUtils.getSelectedEpiCard(this.model.languageTypeCards, this.model.modalData.languages.value, this.model.modalData.types.value);
        if (selectedEpi && selectedEpi.action !== LeafletService.LEAFLET_CARD_STATUS.DELETE) {
          this.notificationHandler.reportUserRelevantWarning(`You are about to update an existing leaflet`)
        }
        let xmlContent;
        for (let file of this.uploadedFiles) {
          if (!file.name) {
            continue;
          }
          if (file.name.endsWith('.xml')) {
            xmlContent = await LeafletService.getFileContent(file);
            break;
          }
        }

        let xmlService = new XMLDisplayService(this.element);
        let htmlXMLContent = xmlService.getHTMLFromXML("", xmlContent);
        let leafletHtmlContent = xmlService.buildLeafletHTMLSections(htmlXMLContent);
        if (!leafletHtmlContent) {
          await this.showErrorModal("Unsupported format for uploaded XML file", "Error parsing XML file", () => {
            return
          }, () => {
            return
          }, {disableExpanding: true, disableFooter: true, disableClosing: false})
        } else {
          this.model.modalData.filesWereNotSelected = this.uploadedFiles.length === 0;
        }
      }


    })

    this.onTagClick("delete-language-leaflet", (model, target, event) => {
      let eventData = target.firstElementChild.innerText.split('/');
      let selectedEpiCard = epiUtils.getSelectedEpiCard(this.model.languageTypeCards, eventData[0], eventData[1]);
      selectedEpiCard.action = LeafletService.LEAFLET_CARD_STATUS.DELETE;
      if (selectedEpiCard.videoSource) {
        this.model.videoSourceUpdated = true;
      }
      this.updateCardsForDisplay();
    });

    this.onTagClick("preview-epi", async (epiModel, target, event) => {

      utils.displayLoader();
      let selectedEpi = epiUtils.getSelectedEpiCard(this.model.languageTypeCards, epiModel.language.value, epiModel.type.value);
      let {previewModalTitle, epiData} = await epiUtils.getPreviewModel(this.model, selectedEpi);
      this.model.previewModalTitle = previewModalTitle;
      this.model.epiData = epiData;

      this.showModalFromTemplate("preview-epi/template", () => {
      }, () => {
      }, {disableExpanding: true, disableFooter: true, model: this.model, controller: "modals/PreviewEpiController"});
      utils.hideLoader();

    })
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
    this.model.filesChooser.uploadedFiles = [];
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
      filesWereNotSelected: true,
    }


    /*    this.on("uploadLeaflet", (event) => {
          this.model.modalData.files = event.detail;
          if (this.model.modalData.files.length > 0) {
            this.model.modalData.filesWereNotSelected = false;
          }
        });*/


    this.showModalFromTemplate('select-language-and-type-modal', () => {

      const select = document.getElementsByClassName('document-type-select')[0];
      let selectedType = this.model.modalData.types.value;
      let selectedLanguage = Languages.getListAsVM().find(lang => lang.value === this.model.modalData.languages.value);
      let leafletAction;
      let selectedEpi = epiUtils.getSelectedEpiCard(this.model.languageTypeCards, selectedLanguage.value, selectedType);
      if (selectedEpi) {
        if (selectedEpi.action !== LeafletService.LEAFLET_CARD_STATUS.DELETE) {
          alert(`You are about to update an existing leaflet for ${selectedLanguage.label} language`);
        }
        leafletAction = LeafletService.LEAFLET_CARD_STATUS.UPDATE;
        //  this.model.languageTypeCards.splice(cardIndex, 1);
        this.model.languageTypeCards = this.model.languageTypeCards.filter(card => card.type.value !== selectedType || card.language.value !== selectedLanguage.value);
      } else {
        leafletAction = LeafletService.LEAFLET_CARD_STATUS.NEW
      }


      let videoSource = btoa(this.model.modalData.product.videoSource);
      let card = LeafletService.generateCard(leafletAction, selectedType, selectedLanguage.value, this.uploadedFiles, videoSource);
      this.model.filesChooser.uploadedFiles = [];
      this.model.languageTypeCards.push(card);
      if (videoSource) {
        this.model.videoSourceUpdated = true;
      }
      this.updateCardsForDisplay();
    }, () => {
      this.model.filesChooser.uploadedFiles = [];
      return
    }, {model: this.model});
  }


  updateCardsForDisplay() {
    this.model.languageTypeCardsForDisplay = this.model.languageTypeCards.filter(card => card.action !== LeafletService.LEAFLET_CARD_STATUS.DELETE)

  }


}

