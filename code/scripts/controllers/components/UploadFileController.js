const {FwController} = WebCardinal.controllers;

export default class UploadController extends FwController {
  constructor(...args) {
    super(...args);
    this.model.uploadedFiles = [];
    this.inputElement = this.element.querySelector("input")
    this.uploadEventListener();

    this.onTagClick("remove-from-list", (model, target, event) => {
      if (this.model.uploadedFiles) {
        let fileName = target.getAttribute("fileName");
        this.model.uploadedFiles = this.model.uploadedFiles.filter(file => file.name != fileName);
        this.dispatchCustomEvent(this.model.uploadedFiles);
      }
    })
  }

  triggerFileSelect = (model, target, event) => {
    event.stopImmediatePropagation();
    let fileSelect = this.element.querySelector("input");
    fileSelect.value = '';
    fileSelect.click();
  }

  uploadFileHandler = (event) => {
    let files = Array.from(event.target.files);

    if (files.length === 0) {
      return;
    }

    if (this.model.filesAppend) {
      files = [...this.model.uploadedFiles, ...files]
    }

    this.model.uploadedFiles = files;
    this.dispatchCustomEvent(this.model.uploadedFiles)
  }

  dispatchCustomEvent = (files) => {
    this.element.dispatchEvent(new CustomEvent(this.model['event-name'], {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: files
    }));
  }

  uploadEventListener = () => {
    if (this.model.accept && this.model.accept === "directory") {
      this.inputElement.setAttribute("directory", "");
      this.inputElement.setAttribute("mozdirectory", "");
      this.inputElement.setAttribute("webkitdirectory", "");
    } else {
      this.inputElement.setAttribute("accept", this.model.accept);
    }
    this.inputElement.addEventListener('change', this.uploadFileHandler);
    this.onTagClick('upload-files', this.triggerFileSelect);
  }

}
