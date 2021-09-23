import ContainerController from "../../cardinal/controllers/base-controllers/ContainerController.js";
import constants from "./constants.js";
import {copyToClipboard} from "../helpers/document-utils.js";

let crypto = require("opendsu").loadApi("crypto");


export default class HolderController extends ContainerController {
    constructor(element, history) {
        super(element, history);


        this.setModel({displayCredentialArea: true, isInvalidCredential: false});
        this.model.domain = "epi";

        const setCredential = credential => {
            this.model.credential = credential;
            this.model.isInvalidCredential = false;

            crypto.parseJWTSegments(this.model.credential, (parseError, jwtContent) => {
                if (parseError) {
                    this.model.isInvalidCredential = true;
                    return console.log('Error parsing user credential', parseError);
                }
                //console.log('Parsed credential', jwtContent);
                const {header, body} = jwtContent;
                this.model.readableCredential = JSON.stringify({header, body}, null, 4);

                const readableContainer = this.element.querySelector('#readableContainer');
                let readableCredentialElement = readableContainer.querySelector('#readableCredential');
                if (readableCredentialElement) {
                    readableCredentialElement.remove();
                }

                readableCredentialElement = document.createElement('psk-code');
                readableCredentialElement.id = "readableCredential";
                readableCredentialElement.title = "Human readable Credential";
                readableCredentialElement.language = "json";
                readableCredentialElement.innerHTML = this.model.readableCredential;
                readableContainer.appendChild(readableCredentialElement);
                this.DSUStorage.enableDirectAccess(() => {
                    let sc = require("opendsu").loadAPI("sc");
                    sc.getMainDSU((err, mainDSU) => {
                        if (err) {
                            return console.log('Error getting mainDSU', err);
                        }
                        mainDSU.getKeySSIAsString((err, keySSI) => {
                            this.model.walletKeySSI = keySSI
                        });
                    })
                })
            });
        }

        this.DSUStorage.getObject(constants.WALLET_DID_PATH, (err, didObj) => {
            if (err) {
                return console.log(err);
            }

            this.model.did = didObj.did;
            this.DSUStorage.getObject(constants.WALLET_CREDENTIAL_FILE_PATH, (err, credential) => {
                if (err || !credential) {
                    this.model.displayCredentialArea = false;
                } else {
                    this.model.displayCredentialArea = true;
                    setCredential(credential.credential);
                }
            });
        });

        this.on('openFeedback', (e) => {
            this.feedbackEmitter = e.detail;
        });

        this.on('copy-text', (e) => {
            copyToClipboard(e.data);
        });
    }
}
