import {copyToClipboard} from "../helpers/document-utils.js";

const {FwController} = WebCardinal.controllers;

let crypto = require("opendsu").loadApi("crypto");
const openDSU = require("opendsu");
const config = openDSU.loadAPI("config");
const LogService = require("gtin-resolver").loadApi("services").LogService;

export default class HolderController extends FwController {
  constructor(element, history) {
    super(element, history);


    this.model = {displayCredentialArea: true, isInvalidCredential: false};
    this.model.domain = "epi";

    const setCredential = credential => {
      this.model.credential = credential;
      this.model.isInvalidCredential = false;

      crypto.parseJWTSegments(this.model.credential, async (parseError, jwtContent) => {
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
        });

        await this.renderSettingsContainer();
      });
    }
    const scAPI = openDSU.loadAPI("sc");
    scAPI.getMainEnclave(async (err, mainEnclave) => {
      if (err) {
        return console.log(err);
      }
      try {
        let did = await $$.promisify(mainEnclave.readKey)("did");
        this.model.did = did;
        let credential = await $$.promisify(mainEnclave.readKey)("credential");
        this.model.displayCredentialArea = !!credential;
        if (this.model.displayCredentialArea) {
          setCredential(credential);
        }
      } catch (e) {
        this.model.displayCredentialArea = false;
      }
    });

    this.on('openFeedback', (e) => {
      this.feedbackEmitter = e.detail;
    });

    this.on('copy-text', (e) => {
      copyToClipboard(e.data);
    });

    this.onTagClick("edit-settings", (model, target, event) => {
      let oldValue = this.model.envData;
      this.showModalFromTemplate("manage-available-features", () => {
          this.renderSettingsContainer().then(() => {
            let logService = new LogService();
            let useData = this.model.did.split(":");
            let diffs = {oldValue: oldValue.disabledFeatures, newValue: this.model.envData.disabledFeatures}
            logService.log({
                diffs,
                logInfo: this.model.envData,
                username: useData[useData.length - 1],
                action: `Changed features`,
                metadata: ""
              }, () => {
              }
            );

            return;
          }).catch(err => {
            console.log(err);
            return;
          })
        }, () => {
          return;
        },
        {controller: "FeaturesModalController"}
      );
    });
  }

  async renderSettingsContainer() {
    let envFile = await $$.promisify(config.readEnvFile)();
    this.model.editableFeatures = !(!!envFile.lockFeatures);
    this.model.envData = envFile;
    const environmentContainer = this.element.querySelector('#environmentContainer');
    let environmentDataElement = environmentContainer.querySelector('#environmentData');
    if (environmentDataElement) {
      environmentDataElement.remove();
    }
    environmentDataElement = document.createElement('psk-code');
    environmentDataElement.id = "environmentData";
    environmentDataElement.language = "json";
    environmentDataElement.innerHTML = JSON.stringify(envFile, null, 4);
    environmentContainer.appendChild(environmentDataElement);
    return;

  }
}
