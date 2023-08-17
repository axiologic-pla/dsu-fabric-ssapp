import {copyToClipboard} from "../helpers/document-utils.js";
import utils from "../utils.js";
import constants from "../constants.js";
import {getPermissionsWatcher} from "../services/PermissionsWatcher.js";

const {FwController} = WebCardinal.controllers;

const getUserDetails = utils.getUserDetails;

function GenerateDIDController(...props) {
  let self = new FwController(...props);
  self.initPermissionsWatcher = ()=>{ };
  if (!$$.history) {
    $$.history = props[1];
  }
  self.model = {};

  const openDSU = require("opendsu");
  const w3cDID = openDSU.loadAPI("w3cdid");
  const scAPI = openDSU.loadAPI("sc");

  scAPI.getMainEnclave(async (err, mainEnclave) => {
    if (err) {
      self.notificationHandler.reportUserRelevantError("Failed to initialize wallet", err);
      setTimeout(() => {
        window.disableRefreshSafetyAlert = true;
        window.location.reload()
      }, 2000)
      return;
    }

    try {
      self.mainDSU = await $$.promisify(scAPI.getMainDSU)();
    } catch (e) {
      self.notificationHandler.reportUserRelevantError("Failed to initialize wallet", err);
      setTimeout(() => {
        window.disableRefreshSafetyAlert = true;
        window.location.reload()
      }, 2000)
      return;
    }

    self.mainEnclave = mainEnclave;
    let did;
    try {
      did = await $$.promisify(mainEnclave.readKey)(constants.IDENTITY_KEY);
    } catch (e) {
      // TODO check error type to differentiate between business and technical error
     // self.notificationHandler.reportDevRelevantInfo("DID not yet created", e);
    }

    if (!did) {
      did = await self.createDID();
    }

    this.permissionsWatcher = getPermissionsWatcher(did, self.authorizationIsDone);
    self.denyAccess();
    self.model.identity = did;
    try{
      await self.mainEnclave.safeBeginBatchAsync();
    }catch (e) {
      throw e;
    }
    try{
      await $$.promisify(self.mainEnclave.writeKey)(constants.IDENTITY_KEY, self.model.identity);
      await self.mainEnclave.commitBatchAsync();
    } catch (e) {
      const writeKeyError = createOpenDSUErrorWrapper(`Failed to write key`, e);
      try {
        await self.mainEnclave.cancelBatchAsync();
      } catch (error) {
        throw createOpenDSUErrorWrapper(`Failed to cancel batch`, error, writeKeyError);
      }
      throw writeKeyError;
    }
  })

  self.onTagClick("copy-text", (event) => {
    copyToClipboard(event.identity);
  })

  self.createDID = async () => {
    const userDetails = await getUserDetails();
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

  self.showSpinner = () => {
    WebCardinal.loader.hidden = false;
  }

  self.hideSpinner = () => {
    WebCardinal.loader.hidden = true;
  }

  self.authorizationIsDone = () => {
    self.hideSpinner();
    WebCardinal.root.hidden = false;
    self.navigateToPageTag("home");
  }

  self.denyAccess = () => {
    WebCardinal.root.hidden = false;
    self.element.parentElement.hidden = false;
    self.hideSpinner();
  }



  return self;
}

export default GenerateDIDController;
