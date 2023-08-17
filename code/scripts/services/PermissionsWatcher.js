import constants from "./../constants.js";
import utils from "./../utils.js";

const openDSU = require("opendsu");
const w3cDID = openDSU.loadAPI("w3cdid");
const scAPI = openDSU.loadAPI("sc");
const defaultHandler = function(){console.log("User is authorized")};

class PermissionsWatcher {
  constructor(did, isAuthorizedHandler) {
    this.notificationHandler = openDSU.loadAPI("error");
    this.isAuthorizedHandler = isAuthorizedHandler || defaultHandler;
    if (did) {
      this.checkAccess();
      this.setup(did);
    } else {
      console.log("Trying retrieve DID info...");
      scAPI.getMainEnclave(async (err, mainEnclave) => {
        if (err) {
          console.log(err);
          return;
        }
        did = await $$.promisify(mainEnclave.readKey)(constants.IDENTITY_KEY);
        this.setup(did);
      });
    }
  }

  setup(did){
    if(!window.commHub){
      this.typicalBusinessLogicHub = w3cDID.getTypicalBusinessLogicHub();
      window.commHub = this.typicalBusinessLogicHub;
      $$.promisify(this.typicalBusinessLogicHub.setMainDID)(did).then(() => {
        this.typicalBusinessLogicHub.subscribe(constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP, (...args)=>{
          this.onUserAdded(...args);
        });
        this.typicalBusinessLogicHub.strongSubscribe(constants.MESSAGE_TYPES.USER_REMOVED, (...args)=>{
          this.onUserRemoved(...args);
        });
      }).catch(err => {
        console.log("Failed to setup typical business logic hub", err);
      });
    }
  }

  onUserRemoved(message) {
    $$.disableAlerts();
    this.typicalBusinessLogicHub.stop();
    scAPI.getMainEnclave(async (err, mainEnclave) => {
      if (err) {
        console.log(err);
      }

      try {
        await $$.promisify(mainEnclave.writeKey)(constants.CREDENTIAL_KEY, constants.CREDENTIAL_DELETED);
        await $$.promisify(scAPI.deleteSharedEnclave)();
        //scAPI.refreshSecurityContext();
      } catch (err) {
        try {
          scAPI.refreshSecurityContext();
          await $$.promisify(scAPI.deleteSharedEnclave)();
          await $$.promisify(mainEnclave.writeKey)(constants.CREDENTIAL_KEY, constants.CREDENTIAL_DELETED);
        } catch (e) {
          console.log(e);
        }
      }
      return $$.forceTabRefresh();
    });
  }

  async getUserRights() {
    let userRights;
    const openDSU = require("opendsu");
    const scAPI = openDSU.loadAPI("sc");
    const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
    let credential = await $$.promisify(mainEnclave.readKey)(constants.CREDENTIAL_KEY);

    if (credential.allPossibleGroups) {
      const did = await $$.promisify(mainEnclave.readKey)(constants.IDENTITY_KEY);
      for (let group of credential.allPossibleGroups) {
        if (await isInGroup(group.did, did)) {
          switch (group.accessMode) {
            case "read":
              userRights = constants.USER_RIGHTS.READ;
              break;
            case "write":
              userRights = constants.USER_RIGHTS.WRITE;
              break;
          }
          break;
        }
      }
    }

    if (!userRights) {
      //todo: add new constant in opendsu.containts for root-cause security
      throw createOpenDSUErrorWrapper("Unable to get user rights!", new Error("User is not present in any group."), "security");
    }

    return userRights;
  }

  async onUserAdded(message) {
    scAPI.getMainEnclave(async (err, mainEnclave) => {
      if (err) {
        this.notificationHandler.reportUserRelevantError("Failed to initialize wallet", err);
        return;
      }

      const saveCredential = async (credential) => {
        try {
          mainEnclave.beginBatch();
          await $$.promisify(mainEnclave.writeKey)(constants.CREDENTIAL_KEY, credential);
          await $$.promisify(mainEnclave.commitBatch)();
        } catch (e) {
          this.notificationHandler.reportUserRelevantError("Failed to save wallet credentials. Retrying ... ");
          return await saveCredential(message);
        }
      }
      const setSharedEnclave = async (message) => {
        try {
          await this.setSharedEnclaveFromMessage(message.enclave);
        } catch (e) {
          this.notificationHandler.reportUserRelevantError("Failed to finish authorisation process. Retrying ... ");
          return await setSharedEnclave(message);
        }
      }

      await saveCredential(message.credential);
      await setSharedEnclave(message);
      this.isAuthorizedHandler();
    });
  }

  async setSharedEnclaveFromMessage(enclave) {
    try {
      const mainDSU = await $$.promisify(scAPI.getMainDSU)();
      let env = await $$.promisify(mainDSU.readFile)("/environment.json");
      env = JSON.parse(env.toString());
      const openDSU = require("opendsu");
      env[openDSU.constants.SHARED_ENCLAVE.TYPE] = enclave.enclaveType;
      env[openDSU.constants.SHARED_ENCLAVE.DID] = enclave.enclaveDID;
      env[openDSU.constants.SHARED_ENCLAVE.KEY_SSI] = enclave.enclaveKeySSI;
      await $$.promisify(scAPI.configEnvironment)(env);
    } catch (e) {
      this.notificationHandler.reportUserRelevantError(`Failed to save info about the shared enclave`, e);
    }
  }

  async checkAccess() {
    let sharedEnclave;
    try {
      sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
    } catch (err) {
      // TODO check error type to differentiate between business and technical error
      this.notificationHandler.reportDevRelevantInfo("User is waiting for access to be granted")
    }

    if (sharedEnclave) {
      let userRights;
      try {
        userRights = await utils.getUserRights();
      } catch (err) {
        if (err.rootCause === "security") {
          return false;
        }
        return $$.forceTabRefresh();
      }
      return this.isAuthorizedHandler();
    }
    return false;
  }
}

export function getPermissionsWatcher(did, isAuthorizedHandler) {
  return new PermissionsWatcher(did, isAuthorizedHandler);
};