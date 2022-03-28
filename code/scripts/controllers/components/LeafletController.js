const gtinResolver = require("gtin-resolver");
const LeafletService = gtinResolver.DSUFabricUtilsService;
const Languages = gtinResolver.Languages
const UploadTypes = gtinResolver.UploadTypes
const {WebcController} = WebCardinal.controllers;

export default class LeafletController extends WebcController {

  constructor(...props) {
    super(...props);
    this.model.deletedLanguageTypeCards = [];
    this.onTagClick("add-language-leaflet", (event) => {
      this.addLanguageTypeFilesListener(event)
    });

    this.onTagClick("delete-language-leaflet", (model, target, event) => {
      let eventData = target.firstElementChild.innerText.split('/');
      this.model.languageTypeCards = this.model.languageTypeCards.filter(lf => {
        if (!(lf.type.value === eventData[1] && lf.language.value === eventData[0])) {
          return true
        }

        if (lf.status === LeafletService.LEAFLET_CARD_STATUS.EXISTS) {
          lf.status = LeafletService.LEAFLET_CARD_STATUS.DELETE;
          this.model.deletedLanguageTypeCards.push(lf);
          if (lf.videoSource) {
            this.model.videoSourceUpdated = true;
          }
        }
        return false
      });
    });
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
      label: "Language",
      placeholder: "Select a language",
      options: Languages.getListAsVM()
    };
    const types = {
      componentLabel: "Type",
      placeholder: "Select a type",
      options: UploadTypes.getListAsVM(disabledFeatures)
    };
    this.model.modalData = {
      title: "Choose language and type of upload",
      acceptButtonText: 'Accept',
      denyButtonText: 'Cancel',
      languages: languages,
      types: types,
      product: {
        language: "en",
        type: "leaflet",
        videoSource: ""
      },
      fileChooser: {
        accept: "directory",
        "event-name": "uploadLeaflet",
        label: "Upload files",
        "list-files": true
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
      const select = document.getElementsByClassName('document-type-select')[0];
      let selectedType = select.options[select.selectedIndex].value;
      let videoSource = btoa(this.model.modalData.product.videoSource);
      let card = LeafletService.generateCard(LeafletService.LEAFLET_CARD_STATUS.NEW, selectedType, selectedLanguage.value, this.model.modalData.files, videoSource);
      this.model.languageTypeCards.push(card);
      if (videoSource) {
        this.model.videoSourceUpdated = true;
      }
    }, () => {
      return
    }, {model: this.model});
  }


  typeAndLanguageExist(language, type) {
    return this.model.languageTypeCards.findIndex(lf => lf.type.value === type && lf.language.value === language) !== -1;
  }

}

