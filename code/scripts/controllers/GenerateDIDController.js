import {copyToClipboard} from "../helpers/document-utils.js";
import utils from "../utils.js";
import {getCommunicationService} from "../services/CommunicationService.js";

const {WebcController} = WebCardinal.controllers;

const getUserDetails = utils.getUserDetails;

export default class GenerateDIDController extends WebcController {
  constructor(...props) {
    super(...props);

    this.model = {};

    const openDSU = require("opendsu");
    const w3cDID = openDSU.loadAPI("w3cdid");
    const scAPI = openDSU.loadAPI("sc");
    const sc = scAPI.getSecurityContext();

    const __generateDID = async () => {
      const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
      let did;
      try {
        did = await $$.promisify(mainEnclave.readKey)("did");
      } catch (e) {
        //console.log("Failed to read DID ", e);
        console.log("DID not yet created");
      }

      const __waitForAuthorization = async () => {
        let credential;
        try {
          credential = await $$.promisify(mainEnclave.readKey)("credential");
        } catch (e) {

        }

        if (!credential || credential === "deleted") {
          this.authorizationStillInProgress();

          try {
            await $$.promisify(getCommunicationService(this.DSUStorage).waitForMessage)(this);
          } catch (e) {
            throw e;
          }
          await this.authorizationIsDone();
          return;
        }

        await this.authorizationIsDone();
      };

      if (!did) {
        const userDetails = await getUserDetails();
        const vaultDomain = await $$.promisify(scAPI.getVaultDomain)();
        const openDSU = require("opendsu");
        const config = openDSU.loadAPI("config");
        let appName = await $$.promisify(config.getEnv)("appName");
        let userId = `${appName}/${userDetails.username}`;
        let i = 1;
        do {
          try {
            did = await $$.promisify(w3cDID.resolveDID)(`did:ssi:name:${vaultDomain}:${userId}`);
          } catch (e) {
            did = null;
          }
          if (did) {
            userId = userId + i++;
          }
        } while (did)

        did = await $$.promisify(w3cDID.createIdentity)("ssi:name", vaultDomain, userId);
        this.model.identity = did.getIdentifier();
        await $$.promisify(mainEnclave.writeKey)("did", this.model.identity);
        //await $$.promisify(this.DSUStorage.setObject.bind(this.DSUStorage))(constants.WALLET_DID_PATH, {did: did.getIdentifier()});
        await __waitForAuthorization();
      } else {
        this.model.identity = did;
        did = await $$.promisify(w3cDID.resolveDID)(did);
        await __waitForAuthorization();
      }
    };

    if (sc.isInitialised()) {
      return __generateDID();
    }

    sc.on("initialised", __generateDID);
    this.on("copy-text", (event) => {
      copyToClipboard(event.data);
    });
  }

  showSpinner() {
    WebCardinal.loader.hidden = false;
  }

  hideSpinner() {
    WebCardinal.loader.hidden = true;
  }

  async authorizationIsDone() {
    this.hideSpinner();
    WebCardinal.root.hidden = false;
    this.navigateToPageTag("home");
  }

  authorizationStillInProgress() {
    WebCardinal.root.hidden = false;
    this.element.parentElement.hidden = false;
    this.hideSpinner();
  }
}
