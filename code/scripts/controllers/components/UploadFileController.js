const { FwController } = WebCardinal.controllers;

export default class UploadController extends FwController {
    constructor(...args) {
        super(...args);

        this.uploadEventListener();
        // this.element.getAttribute(buttonLabel);
    }

    triggerFileSelect = (model, target, event) => {
        event.stopImmediatePropagation();
        let fileSelect = this.element.querySelector("input");
        fileSelect.value = '';
        fileSelect.click();
    }

    uploadFileHandler = (event) => {
        let files = Array.from(event.target.files);;

        if (files.length === 0) {
            return;
        }
        this.element.dispatchEvent(new CustomEvent(this.model['event-name'], {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: files
        }));

        this.model.uploadedFiles = files;
    }

    uploadEventListener = () => {
        this.element.querySelector("input").addEventListener('change', this.uploadFileHandler);
        this.onTagClick('upload-files', this.triggerFileSelect);
    }

}
