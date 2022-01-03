import constants from "./constants.js";
import { copyToClipboard } from "../helpers/document-utils.js";
import utils from "../utils.js";
import { getCommunicationService } from "../services/CommunicationService.js";

const { WebcController } = WebCardinal.controllers;

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
      let did;
      try {
        did = await $$.promisify(
          this.DSUStorage.getObject.bind(this.DSUStorage)
        )(constants.WALLET_DID_PATH);
      } catch (e) {
        console.log("Failed to read DID ", e);
      }

      const __waitForAuthorization = async () => {
        const credential = await $$.promisify(
          this.DSUStorage.getObject.bind(this.DSUStorage)
        )(constants.WALLET_CREDENTIAL_FILE_PATH);

        if (!credential) {
          this.authorizationStillInProgress();

          try {
            await $$.promisify(
              getCommunicationService(this.DSUStorage).waitForMessage
            )();
          } catch (e) {
            throw e;
          }
          this.authorizationIsDone();
          return;
        }

        this.authorizationIsDone();
      };

      if (!did) {
        const userDetails = await getUserDetails();
        const vaultDomain = await $$.promisify(scAPI.getVaultDomain)();
        try {
          did = await $$.promisify(w3cDID.resolveDID)(
            `did:ssi:name:${vaultDomain}:${userDetails.username}`
          );
        } catch (e) {}
        if (did) {
          throw Error(
            `The identity did:ssi:name:${vaultDomain}:${userDetails.username} was already created`
          );
        }
        did = await $$.promisify(w3cDID.createIdentity)(
          "ssi:name",
          vaultDomain,
          userDetails.username
        );
        this.model.identity = did.getIdentifier();
        await $$.promisify(
          this.DSUStorage.setObject.bind(this.DSUStorage)
        )(constants.WALLET_DID_PATH, { did: did.getIdentifier() });
        await __waitForAuthorization();
      } else {
        this.model.identity = did.did;
        did = await $$.promisify(w3cDID.resolveDID)(did.did);
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

  authorizationIsDone() {
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
