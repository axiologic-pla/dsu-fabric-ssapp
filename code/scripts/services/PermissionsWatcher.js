import constants from "./../constants.js";
import utils from "../utils.js";

const openDSU = require("opendsu");
const scAPI = openDSU.loadAPI("sc");
const defaultHandler = function () {
  console.log("User is authorized")
};

const {navigateToPageTag} = WebCardinal.preload;

class PermissionsWatcher {
  constructor(did, isAuthorizedHandler) {
    utils.showTextLoader();
    this.notificationHandler = openDSU.loadAPI("error");
    this.isAuthorizedHandler = isAuthorizedHandler || defaultHandler;

    this.checkAccessAndAct().catch(err => {
      console.debug('Caught an error during booting of the PermissionsWatcher...', err);
    });

    this.setupIntervalCheck();
  }

  setupIntervalCheck() {
    //setup of credential check interval to prevent edge cases
    if (!window.credentialsCheckInterval) {
      const interval = 10*1000;
      window.credentialsCheckInterval = setInterval(async () => {
        this.checkAccessAndAct().catch(err => {
          console.debug("Just logging some errors for debugging if needed", err);
        });
      }, interval);
      console.log(`Permissions will be checked once every ${interval}ms`);
    }
  }

  async checkAccessAndAct() {
    this.checkAccess().then(async (hasAccess) => {
      utils.hideTextLoader();
      let unAuthorizedPages = ["generate-did", "landing-page"];
      if (hasAccess) {
        if (unAuthorizedPages.indexOf(WebCardinal.state.page.tag) !== -1) {
          //if we are on a booting page then we need to redirect...

          return this.isAuthorizedHandler();
        }
      } else {
        if (unAuthorizedPages.indexOf(WebCardinal.state.page.tag) !== -1) {
          //if we are on a booting page, and we are not authorized ...
          let did = await scAPI.getMainDIDAsync();
          navigateToPageTag("generate-did", did);
          return;
        }

        //we try to reset no matter if we had or no any credentials...
        await this.resettingCredentials();

        this.notificationHandler.reportUserRelevantInfo("Your credentials were removed.");
        this.notificationHandler.reportUserRelevantInfo("Application will refresh soon...");
        $$.forceTabRefresh();
        return;
      }
    }).catch(async err => {
      //at this point this check if fails may not be that important....
    });
  }

  async saveCredentials(credentials) {
    let enclave = credentials.enclave;
    if (window.lastCredentials && enclave.enclaveKeySSI === window.lastCredentials.enclaveKeySSI) {
      // there is no need to trigger the credentials save...
      return;
    }
    window.lastCredentials = enclave;
    try {
      const mainDSU = await $$.promisify(scAPI.getMainDSU)();
      let env = await $$.promisify(mainDSU.readFile)("/environment.json");
      env = JSON.parse(env.toString());
      const openDSU = require("opendsu");
      env[openDSU.constants.SHARED_ENCLAVE.TYPE] = enclave.enclaveType;
      env[openDSU.constants.SHARED_ENCLAVE.DID] = enclave.enclaveDID;
      env[openDSU.constants.SHARED_ENCLAVE.KEY_SSI] = enclave.enclaveKeySSI;
      await $$.promisify(scAPI.configEnvironment)(env);

      const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
      let batchId = await mainEnclave.startOrAttachBatchAsync();
      await $$.promisify(mainEnclave.writeKey)(constants.CREDENTIAL_KEY, credentials.groupCredential);
      await $$.promisify(mainEnclave.commitBatch)(batchId);
    } catch (e) {
      this.notificationHandler.reportUserRelevantError("Failed to save wallet credentials.", e);
      return $$.forceTabRefresh();
    }
  }

  async resettingCredentials() {
    let mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
    await $$.promisify(mainEnclave.writeKey)(constants.CREDENTIAL_KEY, constants.CREDENTIAL_DELETED);
    await $$.promisify(scAPI.deleteSharedEnclave)();
  }

  async checkAccess() {
    if (!this.did) {
      try {
        this.did = await scAPI.getMainDIDAsync();
      } catch (err) {
        this.notificationHandler.reportUserRelevantError(`Failed to load the wallet`, err);
        this.notificationHandler.reportUserRelevantInfo(
          "Application will refresh soon to ensure proper state. If you see this message again, check network connectivity and if necessary get in contact with Admin.");
        return $$.forceTabRefresh();
      }
    }

    if (!this.handler) {
      try {
        let SecretsHandler = require("opendsu").loadApi("w3cdid").SecretsHandler;
        this.handler = await SecretsHandler.getInstance(this.did);
      } catch (err) {
        this.notificationHandler.reportUserRelevantError(`Failed to load the wallet`, err);
        this.notificationHandler.reportUserRelevantInfo(
          "Application will refresh soon to ensure proper state. If you see this message again, check network connectivity and if necessary get in contact with Admin.");
        return $$.forceTabRefresh();
      }
    }

    try {
      let creds = await this.handler.checkIfUserIsAuthorized(this.did);
      if (creds) {
        await this.saveCredentials(creds);
        if (!window.lastGroupDID) {
          window.lastGroupDID = creds ? creds.groupCredential.groupDID : undefined;
        }
        if (window.lastGroupDID !== creds.groupCredential.groupDID) {
          this.notificationHandler.reportUserRelevantInfo("Your credentials have changed!");
          this.notificationHandler.reportUserRelevantInfo("Application will refresh soon...");
          return $$.forceTabRefresh();
        }
        return true;
      }
    } catch (err) {
      let knownStatusCodes = [404, 500];
      if (knownStatusCodes.indexOf(err.code) === -1) {
        throw err;
      }
      console.debug("Caught an error during checking access", err);
    }
    return false;
  }
}

export function getPermissionsWatcher(did, isAuthorizedHandler) {
  return new PermissionsWatcher(did, isAuthorizedHandler);
};
