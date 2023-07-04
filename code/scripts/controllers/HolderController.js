import {copyToClipboard} from "../helpers/document-utils.js";
import constants from "../constants.js";

const {FwController} = WebCardinal.controllers;

const openDSU = require("opendsu");
const config = openDSU.loadAPI("config");
const credentialsAPI = openDSU.loadAPI("credentials");
const LogService = require("gtin-resolver").loadApi("services").LogService;

export default class HolderController extends FwController {
  constructor(element, history) {
    super(element, history);


    this.model = {displayCredentialArea: true, isInvalidCredential: false};
    this.model.domain = "epi";

    const setCredential = credential => {
      this.model.credential = credential;
      this.model.isInvalidCredential = false;

      credentialsAPI.parseJWTSegments(this.model.credential.token, async (parseError, jwtContent) => {
        if (parseError) {
          this.model.isInvalidCredential = true;
          return this.showErrorModalAndRedirect('Error parsing user credential', "Error", {tag: "home"});
        }
        const {jwtHeader, jwtPayload} = jwtContent;
        this.model.readableCredential = JSON.stringify({jwtHeader, jwtPayload}, null, 4);

        const readableContainer = this.element.querySelector('#readableContainer');
        let readableCredentialElement = readableContainer.querySelector('#readableCredential');
        if (readableCredentialElement) {
          readableCredentialElement.remove();
        }

        readableCredentialElement = document.createElement('div');
        readableCredentialElement.id = "readableCredential";
        readableCredentialElement.language = "json";
        readableCredentialElement.innerHTML = `<pre><code> ${this.model.readableCredential} </code></pre>`;
        readableContainer.appendChild(readableCredentialElement);
        /*
         * hidden for MVP1
        this.DSUStorage.enableDirectAccess(() => {
          let sc = require("opendsu").loadAPI("sc");
          sc.getMainDSU((err, mainDSU) => {
            if (err) {
               return this.notificationHandler.reportDevRelevantInfo('Error getting mainDSU', err);

               //return console.log('Error getting mainDSU', err);
            }


            mainDSU.getKeySSIAsString((err, keySSI) => {
                          this.model.walletKeySSI = keySSI
                        });

          })
        });
     */
        await this.renderSettingsContainer();
      });
    }
    const scAPI = openDSU.loadAPI("sc");
    scAPI.getMainEnclave(async (err, mainEnclave) => {
      if (err) {
        this.model.displayCredentialArea = false;
        return this.notificationHandler.reportUserRelevantError('Could not retrieve credentials', err);
        // return console.log(err);
      }
      try {
        let did = await $$.promisify(mainEnclave.readKey)(constants.IDENTITY_KEY);
        this.model.did = did;
        let credential = await $$.promisify(mainEnclave.readKey)(constants.CREDENTIAL_KEY);
        this.model.displayCredentialArea = !!credential;
        if (this.model.displayCredentialArea) {
          setCredential(credential);
        }
      } catch (e) {
        this.model.displayCredentialArea = false;
      }
    });

/*    this.on('openFeedback', (e) => {
      this.feedbackEmitter = e.detail;
    });*/

    this.onTagClick("copy-text", (event) => {
      copyToClipboard(event.did);
    })

    // this.on('copy-text', (e) => {
    //   copyToClipboard(e.data);
    // });

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
                reason: `Changed features`,
                metadata: ""
              }, () => {
              }
            );
          }).catch(err => {
            return this.notificationHandler.reportUserRelevantError('Could not retrieve credentials', err);
          })
        }, () => {
        },
        {controller: "FeaturesModalController"}
      );
    });

    this.onTagClick("download-debug", () => {
      try {
        let logData = JSON.parse($$.memoryLogger.dump());
        let formattedJSON = JSON.stringify(logData, null, 4);
        let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(formattedJSON);
        let downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "debugLog.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      } catch (err) {
        this.showErrorModal(`Something went wrong on download. ${err.message}`, "Error");
      }
      return;
    })
  }

  async renderSettingsContainer() {
    let envFile = await $$.promisify(config.readEnvFile)();
    //hide keySSI properties from display in ui
    delete envFile["enclaveKeySSI"];
    delete envFile["sharedEnclaveKeySSI"];

    this.model.editableFeatures = !(!!envFile.lockFeatures);
    this.model.envData = envFile;
    const environmentContainer = this.element.querySelector('#environmentContainer');
    let environmentDataElement = environmentContainer.querySelector('#environmentData');
    if (environmentDataElement) {
      environmentDataElement.remove();
    }
    environmentDataElement = document.createElement('div');
    environmentDataElement.id = "environmentData";
    environmentDataElement.language = "json";
    environmentDataElement.innerHTML = `<pre><code>${JSON.stringify(envFile, null, 4)}</code></pre>`;
    environmentContainer.appendChild(environmentDataElement);
  }
}
