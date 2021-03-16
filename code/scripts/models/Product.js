import utils from "../utils.js";

export default class Product {
    name = "";
    gtin = "";
    photo = utils.getFetchUrl("/download/code/assets/images/default.png");
    description = "";
    leaflet = "";
    manufName = " ";
    version = 1;
    batchSpecificVersion = false;
    files = [];
    transferred = false;
    reportURL = `${window.top.location.origin}/default-report.html`;
    isCodeEditable= true;
    checkExpiryDate = {
        options: [{
            label: "Yes",
            value: 'true'
        },
            {
                label: "No",
                value: "false"
            }
        ],
        value: 'true'
    };
    checkIncorrectExpiryDate = {
        options: [{
            label: "Yes",
            value: 'true'
        },
            {
                label: "No",
                value: "false"
            }
        ],
        value: 'true'
    };

    constructor(product) {
        if (typeof product !== undefined) {
            for (let prop in product) {
                this[prop] = product[prop];
            }
        }

        if (this.gtin === "") {
            this.gtin = '05290931025615';
        }
        //if it's not first version product name and code should not be changed
        this.isCodeEditable = this.version===1;
    }

    validate() {
        const errors = [];
        if (!this.name) {
            errors.push('Name is required.');
        }

        if (!this.gtin) {
            errors.push('GTIN is required.');
        }

        return errors.length === 0 ? true : errors;
    }

    generateViewModel() {
        return {label: this.name, value: this.gtin}
    }
}
