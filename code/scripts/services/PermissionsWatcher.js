import constants from "./../constants.js";
import utils from "../utils.js";

const openDSU = require("opendsu");
const w3cDID = openDSU.loadAPI("w3cdid");
const scAPI = openDSU.loadAPI("sc");

const defaultHandler = function () {
  console.log("Default authorization handler was called. User is authorized");
};

const {navigateToPageTag} = WebCardinal.preload;

class PermissionsWatcher {
  constructor(did, isAuthorizedHandler) {
    this.notificationHandler = openDSU.loadAPI("error");
    this.isAuthorizedHandler = isAuthorizedHandler || defaultHandler;
    if (did) {
      utils.showLoaderWhenRedirect();
      this.checkAccess().then(result => {
        this.setup(did);
        window.WebCardinal.loader.classList.remove("text-below");
        if (typeof result === "function") {
          result();
        } else {
          navigateToPageTag("generate-did", did);
        }
      }).catch($$.forceTabRefresh)
    } else {
      console.log("Trying retrieve DID info...");
      scAPI.getMainEnclave(async (err, mainEnclave) => {
        if (err) {
          this.notificationHandler.reportUserRelevantError(`Failed to load the wallet`, e);
          this.notificationHandler.reportUserRelevantInfo(
            "Application will refresh soon to ensure proper state. If you see this message again, check network connectivity and if necessary get in contact with Admin.");
          return $$.forceTabRefresh();
        }
        did = await $$.promisify(mainEnclave.readKey)(constants.IDENTITY_KEY);
        this.setup(did);
      });
    }
  }

  enableHttpInterceptor() {
    let http = require("opendsu").loadApi("http");
    let self = this;
    http.registerInterceptor((target, callback) => {
      if ((self.delayMQ || $$.refreshInProgress) && target.url.indexOf("/mq/") !== -1) {
        //we delay all mq requests because we wait for the refresh to happen or message digestion...
        self.registerMQRequest({target, callback});
        return;
      }
      callback(undefined, target);
    });
  }

  registerMQRequest(target) {
    if (!this.delayed) {
      this.delayed = [];
    }
    console.debug("Delaying a mq request.");
    this.delayed.push(target);
  }

  delayMQRequests() {
    this.delayMQ = true;
  }

  resumeMQRequests() {
    this.delayMQ = false;
    if (this.delayed && this.delayed.length) {
      while (this.delayed.length) {
        let delayed = this.delayed.shift();
        console.debug("Resuming mq request.");
        delayed.callback(undefined, delayed.target);
      }
    }
  }

  setup(did) {
    if (!window.commHub) {
      this.typicalBusinessLogicHub = w3cDID.getTypicalBusinessLogicHub();
      window.commHub = this.typicalBusinessLogicHub;

      this.enableHttpInterceptor();

      $$.promisify(this.typicalBusinessLogicHub.setMainDID)(did).then(() => {
        this.setupListeners();
      }).catch(err => {
        console.log("Failed to setup typical business logic hub", err);
      });
    }

    if (!window.credentialsCheckInterval) {
      const interval = 30 * 1000;
      window.credentialsCheckInterval = setInterval(async () => {
        if (this.watchedDSUs && this.watchedDSUs.length) {
          let dsu = await this.getDSUThatChanged();
          if (typeof dsu === "undefined") {
            return;
          }
          await $$.promisify(dsu.refresh)();
        }
        console.debug("Permissions check ...");
        let userRights;
        let unAuthorizedPages = ["generate-did", "landing-page"];
        try {
          userRights = await this.getUserRights();
        } catch (err) {
          //if we have errors user doesn't have any rights
          if (window.lastUserRights || unAuthorizedPages.indexOf(WebCardinal.state.page.tag) === 1) {
            //User had rights and lost them...
            if (err.rootCause === "security") {
              this.notificationHandler.reportUserRelevantError("Security error: ", err);
              this.notificationHandler.reportUserRelevantInfo("The application will refresh soon...");
              $$.forceTabRefresh();
              console.debug("Permissions check -");
            }
          }

          //there is no else that we need to take care of it...
        }
        //if no error user has rights, and we need just to check that nothing changed since last check
        if (userRights && window.lastUserRights && userRights !== window.lastUserRights) {
          //this case is possible if the Admin fails to send the message with the credential due to network issue or something and this is why we should ask for a review of the authorization process.
          console.debug("Permissions check *");
          this.notificationHandler.reportUserRelevantInfo("Your credentials have changed. The application will refresh soon...");
          $$.forceTabRefresh();
          return;
        }

        //if user has rights but is on a page that doesn't need authorization
        // we could believe that app state didn't change properly by various causes...
        // let's try to refresh...
        if (userRights && unAuthorizedPages.indexOf(WebCardinal.state.page.tag) === 1) {
          this.notificationHandler.reportUserRelevantInfo("A possible wrong app state was detected based on current state and credentials. The application will refresh soon...");
          $$.forceTabRefresh();
          return;
        }

      }, interval);
      console.log(`Permissions will be checked once every ${interval}ms`);
    }
  }

  async getDSUThatChanged() {
    for (let dsu of this.watchedDSUs) {
      if (await $$.promisify(dsu.hasNewVersion, dsu)()) {
        return dsu;
      }
    }

    return undefined;
  }

  setupListeners() {
    this.typicalBusinessLogicHub.subscribe(constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP, async (...args) => {
      this.delayMQRequests();
      await this.onUserAdded(...args);
      this.resumeMQRequests();
    });

    this.typicalBusinessLogicHub.strongSubscribe(constants.MESSAGE_TYPES.USER_REMOVED, async (...args) => {
      this.delayMQRequests();
      await this.onUserRemoved(...args);
      this.resumeMQRequests();
    });

    this.typicalBusinessLogicHub.registerErrorHandler((issue) => {
      let {err, message} = issue;
      if (typeof message === "undefined" && err) {
        this.notificationHandler.reportUserRelevantError("Communication error: ", err);
        this.notificationHandler.reportUserRelevantInfo("Application will refresh to establish the communication");
        setTimeout($$.forceTabRefresh, 2000);
        return;
      }
      this.notificationHandler.reportUserRelevantError("Unknown error: ", err);
    });
  }

  async onUserRemoved(message) {
    utils.showLoaderWhenRedirect();
    let hasRights;
    try {
      hasRights = await this.getUserRights();
    } catch (err) {
      //not relevant for now...
      // console.log(err);
    }

    if (hasRights) {
      console.log("Because user is still present in a group, intermediary delete message is skipped.");
      return;
    }

    $$.disableAlerts();
    let caughtErrors = false;
    if (window.lastUserRights) {
      //we had credentials, and now we lost them...
      this.typicalBusinessLogicHub.stop();
    }
    try {
      await this.resettingCredentials();
    } catch (err) {
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
    if (window.lastUserRights) {
      //we had credentials, and now we lost them...
      if (!caughtErrors) {
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
    if (!this.watchedDSUs) {
      this.watchedDSUs = [];
    }
    this.watchedDSUs.push(groupDIDDocument.dsu);
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
    utils.showLoaderWhenRedirect();
    let mainEnclave;
    try {
      mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
    } catch (err) {
      this.notificationHandler.reportUserRelevantError("Failed to initialize wallet", err);
      this.notificationHandler.reportUserRelevantInfo(
        "Application will refresh to ensure proper state. If you see this message again check network connection and if necessary contact Admin.");
      return $$.forceTabRefresh();
    }

    const saveCredential = async (credential) => {
      try {
        mainEnclave.beginBatch();
        await $$.promisify(mainEnclave.writeKey)(constants.CREDENTIAL_KEY, credential);
        await $$.promisify(mainEnclave.commitBatch)();
      } catch (e) {
        this.notificationHandler.reportUserRelevantError("Failed to save wallet credentials.");
        this.notificationHandler.reportUserRelevantError("Request reauthorization!");
        this.notificationHandler.reportUserRelevantInfo("Application will refresh soon...");
        return $$.forceTabRefresh();
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
    try {
      existingCredential = await $$.promisify(mainEnclave.readKey)(constants.CREDENTIAL_KEY);
    } catch (err) {
      //ignorable for the moment...
    }

    if (existingCredential !== message.credential) {
      await saveCredential(message.credential);
      await setSharedEnclave(message);
    } else {
      console.log("There are no changes regarding user credentials");
      return;
    }

    let userRights;
    try {
      userRights = await this.getUserRights();
    } catch (err) {
      //not relevant for now...
      // console.log(err);
    }
    if (window.lastUserRights && window.lastUserRights !== userRights) {
      this.notificationHandler.reportUserRelevantInfo("Your credentials have changed. The application will refresh soon...");
      return $$.forceTabRefresh();
    }
    if (!userRights) {
      return;
    }
    window.lastUserRights = userRights;
    window.WebCardinal.loader.classList.remove("text-below");
    this.isAuthorizedHandler();
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
      this.notificationHandler.reportUserRelevantError("Request reauthorization!");
      this.notificationHandler.reportUserRelevantInfo("Application will refresh soon...");
      return $$.forceTabRefresh();
    }
  }

  async resettingCredentials() {
    scAPI.getMainEnclave(async (err, mainEnclave) => {
      if (err) {
        this.notificationHandler.reportUserRelevantError(`Failed to load the wallet`, e);
        this.notificationHandler.reportUserRelevantInfo(
          "Application will refresh soon to ensure proper state. If you see this message again, check network connectivity and if necessary get in contact with Admin.");
        return $$.forceTabRefresh();
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
      return false;
    }

    if (sharedEnclave) {
      let userRights;
      try {
        userRights = await this.getUserRights();
      } catch (err) {
        if (err.rootCause === "security") {
          return false;
        }
        return $$.forceTabRefresh;
      }
      return this.isAuthorizedHandler;
    }
    return false;
  }
}

export function getPermissionsWatcher(did, isAuthorizedHandler) {
  return new PermissionsWatcher(did, isAuthorizedHandler);
};
