import ModalController from '../../cardinal/controllers/base-controllers/ModalController.js';

export default class UpdateBatchSerialNumbersController extends ModalController {

    constructor(element, history) {
        super(element, history);
        this.acceptButtonOnClick();
        this.denyButtonOnClick();
        this.model.decommissionedType = false;
        this.model.resetAll = false;
        switch (this.model.type){
            case "updateDecommissioned":
                this.model.decommissionedType = true;
                this.model.resetButtonLabel = "Reset all decommissioned serial numbers";
                break;
            case "updateRecalled":
                this.model.resetButtonLabel = "Reset all recalled serial numbers";
                break;
            case "updateValid":
                this.model.resetButtonLabel = "Reset all valid serial numbers";
                break;
        }
        this.model.reason = {
            options: [{label: "Lost", value: "lost"}, {label: "Stolen", value: "stolen"}, {label: "Damaged", value: "dameged"}],
            placeholder: "Select a reason"
        }
    }
    denyButtonOnClick() {
        this.on('deny-button-on-click', (event) => {
            this._finishProcess(event, undefined)
        });
    }

    acceptButtonOnClick() {
        this.on('accept-button-on-click', (event) => {
            this._finishProcess(event, {serialNumbers: this.model.serialNumbers, resetAll: this.model.resetAll, reason: this.model.reason.value})
        });
    }

    _finishProcess(event, response) {
        event.stopImmediatePropagation();
        this.responseCallback(undefined, response);
    };
}
