import constants from "./../constants.js";

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
        this.setupListeners();
      }).catch(err => {
        console.log("Failed to setup typical business logic hub", err);
      });
    }
  }

  setupListeners(){
    this.typicalBusinessLogicHub.subscribe(constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP, (...args)=>{
      this.onUserAdded(...args);
    });
    this.typicalBusinessLogicHub.strongSubscribe(constants.MESSAGE_TYPES.USER_REMOVED, (...args)=>{
      this.onUserRemoved(...args);
    });
  }

  async onUserRemoved(message) {
    let hasRights;
    try{
      hasRights = await this.getUserRights();
    }catch(err){
      //not relevant for now...
      // console.log(err);
    }

    if(hasRights){
      console.log("Because user is still present in a group, intermediary delete message is skipped.");
      return;
    }

    $$.disableAlerts();
    let caughtErrors = false;
    if(window.lastUserRights) {
      //we had credentials, and now we lost them...
      this.typicalBusinessLogicHub.stop();
    }
    try{
      await this.resettingCredentials();
    }catch(err){
      caughtErrors = true;
      try {
        console.log("Refreshing the security context because of errors during credential resetting process.", err);
        scAPI.refreshSecurityContext();
        console.log("Retrying to reset credentials");
        await this.resettingCredentials();
        caughtErrors = false;
      } catch (e) {
        console.log("Caught error during reset credential fallback", e);
        this.notificationHandler.reportUserRelevantError("Your credentials were revoked and the process has partially executed", e);
      }
    }
    if(window.lastUserRights){
      //we had credentials, and now we lost them...
      if(!caughtErrors){
        console.log("User credentials reset process finished with success.");
        this.notificationHandler.reportUserRelevantInfo("Your credentials were revoked.");
      }
      this.notificationHandler.reportUserRelevantInfo("The application will refresh soon...");
      setTimeout($$.forceTabRefresh, 2000);
    }
  }

  async isInGroup(groupDID, did) {
    const openDSU = require("opendsu");
    let resolveDID = $$.promisify(openDSU.loadApi("w3cdid").resolveDID);
    let groupDIDDocument = await resolveDID(groupDID);
    await $$.promisify(groupDIDDocument.dsu.refresh)();
    let groupMembers = await $$.promisify(groupDIDDocument.listMembersByIdentity, groupDIDDocument)();

    for (let member of groupMembers) {
      if (member === did) {
        return true;
      }
    }
    return false
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
        if (await this.isInGroup(group.did, did)) {
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
    let shouldRefresh = false;
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

      let existingCredential;
      try{
        existingCredential = await $$.promisify(mainEnclave.readKey)(constants.CREDENTIAL_KEY);
      }catch(err){
        //ignorable for the moment...
      }

      if(existingCredential !== message.credential){
        await saveCredential(message.credential);
        await setSharedEnclave(message);
      }else{
        console.log("There are no changes regarding user credentials");
        return;
      }

      let userRights;
      try{
        userRights = await this.getUserRights();
      }catch(err){
        //not relevant for now...
        // console.log(err);
      }
      if(window.lastUserRights && window.lastUserRights !== userRights){
        console.log("User rights changed...");
        return $$.forceTabRefresh();
      }
      if(!userRights){
        return;
      }
      window.lastUserRights = userRights;
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

  async resettingCredentials() {
    scAPI.getMainEnclave(async (err, mainEnclave) => {
      if (err) {
        console.log(err);
      }
      await $$.promisify(mainEnclave.writeKey)(constants.CREDENTIAL_KEY, constants.CREDENTIAL_DELETED);
      await $$.promisify(scAPI.deleteSharedEnclave)();
    });
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
        userRights = await this.getUserRights();
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