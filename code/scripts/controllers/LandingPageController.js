import constants from "../constants.js";
import {getPermissionsWatcher} from "../services/PermissionsWatcher.js";
import utils from "../utils.js";

const openDSU = require("opendsu");
const w3cDID = openDSU.loadAPI("w3cdid");
const scAPI = openDSU.loadAPI("sc");

const {FwController} = WebCardinal.controllers;
export default class LandingPageController extends FwController {
  constructor(...props) {
    super(...props);
    this.initPermissionsWatcher = () => {
    };
    const openDSU = require("opendsu");
    const w3cDID = openDSU.loadAPI("w3cdid");
    const scAPI = openDSU.loadAPI("sc");

    scAPI.getMainEnclave(async (err, mainEnclave) => {
      if (err) {
        this.notificationHandler.reportUserRelevantError("Failed to initialize wallet", err);
        setTimeout(() => {
          window.disableRefreshSafetyAlert = true;
          window.location.reload()
        }, 2000)
        return;
      }

      try {
        this.mainDSU = await $$.promisify(scAPI.getMainDSU)();
      } catch (e) {
        this.notificationHandler.reportUserRelevantError("Failed to initialize wallet", err);
        setTimeout(() => {
          window.disableRefreshSafetyAlert = true;
          window.location.reload()
        }, 2000)
        return;
      }

      this.mainEnclave = mainEnclave;
      let did;
      try {
        did = await $$.promisify(mainEnclave.readKey)(constants.IDENTITY_KEY);
      } catch (e) {
        // TODO check error type to differentiate between business and technical error
        // this.notificationHandler.reportDevRelevantInfo("DID not yet created", e);
      }

      if (!did) {
        did = await this.createDID();
      }

      getPermissionsWatcher(did, () => {
        const {navigateToPageTag} = WebCardinal.preload;
        navigateToPageTag("home");
      });


      let identity;
      try {
        identity = await this.mainEnclave.readKeyAsync(constants.IDENTITY);
      } catch (e) {
        identity = undefined;
      }

      if (identity && identity.did === did) {
        return;
      }

      try {
        await this.mainEnclave.safeBeginBatchAsync();
      } catch (e) {
        throw e;
      }
      try {
        await $$.promisify(this.mainEnclave.writeKey)(constants.IDENTITY_KEY, did);
        await this.mainEnclave.commitBatchAsync();
      } catch (e) {
        const writeKeyError = createOpenDSUErrorWrapper(`Failed to write key`, e);
        try {
          await this.mainEnclave.cancelBatchAsync();
        } catch (error) {
          throw createOpenDSUErrorWrapper(`Failed to cancel batch`, error, writeKeyError);
        }
        throw writeKeyError;
      }
    })
  }

  async createDID() {
    const userDetails = await utils.getUserDetails();
    const vaultDomain = await $$.promisify(scAPI.getVaultDomain)();
    const openDSU = require("opendsu");
    const config = openDSU.loadAPI("config");
    let appName = await $$.promisify(config.getEnv)("appName");
    let userId = `${appName}/${userDetails.username}`;
    let did;
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
    return did.getIdentifier();
  }
}
