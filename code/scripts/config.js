import utils from "./utils.js";
import constants from "./constants.js";
import getSharedStorage from "./services/SharedDBStorageService.js";
import WebcDateInput from "../components/date-input/df-date-input.js";

const openDSU = require("opendsu");
const {define} = WebCardinal.components;
const {setConfig, getConfig, addHook, addControllers} = WebCardinal.preload;
const {FwController} = await import("./controllers/FwController.js");

async function watchAndHandleExecution(fnc) {
  try {
    await fnc();
  } catch (err) {
    if (err.rootCause === "security") {
      return $$.navigateToPage("generate-did");
    }
    if (window.confirm("Looks that your application is not properly initialized or in an invalid state. Would you like to reset it?")) {
      try {
        const response = await fetch("/removeSSOSecret/DSU_Fabric", {
          method: "DELETE",
          cache: "no-cache"
        })
        if (response.ok) {
          const basePath = window.location.href.split("loader")[0];
          $$.forceRedirect(basePath + "loader/newWallet.html");
        } else {
          let er = new Error(`Reset request failed (${response.status})`);
          er.rootCause = `statusCode: ${response.status}`;
          throw er;
        }
      } catch (err) {
        $$.showErrorAlert(`Failed to reset the application. RootCause: ${err.message}`);
        $$.forceTabRefresh();
      }
    } else {
      $$.showErrorAlert(`Application is an undesired state! It is a good idea to close all browser windows and try again!`);
      $$.forceTabRefresh();
    }
  }
  return true;
}

async function initializeWebCardinalConfig() {

  const config = getConfig();
  let userDetails;

  await watchAndHandleExecution(async () => {
    userDetails = await utils.getUserDetails();
  });

  config.identity = {
    avatar: "assets/images/user.png"
  }

  if (userDetails) {
    config.identity.name = userDetails.username;
    config.identity.email = userDetails.company;
  }

  return config;
}

let config = await initializeWebCardinalConfig();

async function setupGlobalErrorHandlers() {
  let errHandler = openDSU.loadAPI("error");

  errHandler.observeUserRelevantMessages(constants.NOTIFICATION_TYPES.WARN, (notification) => {
    utils.renderToast(notification.message, constants.NOTIFICATION_TYPES.WARN)
  });

  errHandler.observeUserRelevantMessages(constants.NOTIFICATION_TYPES.INFO, (notification) => {
    utils.renderToast(notification.message, constants.NOTIFICATION_TYPES.INFO)
  });

  errHandler.observeUserRelevantMessages(constants.NOTIFICATION_TYPES.ERROR, (notification) => {
    let errMsg = "";
    if (notification.err && notification.err.message) {
      errMsg = notification.err.message;
    }
    let toastMsg = `${notification.message} ${errMsg}`
    utils.renderToast(toastMsg, constants.NOTIFICATION_TYPES.ERROR)

  });
}

function finishInit() {
  setConfig(config);

  addHook(constants.HOOKS.BEFORE_PAGE_LOADS, 'generate-did', () => {
    WebCardinal.root.disableHeader = true;
  });

  addHook(constants.HOOKS.WHEN_PAGE_CLOSE, 'generate-did', () => {
    WebCardinal.root.disableHeader = false;
  });

  addHook(constants.HOOKS.BEFORE_APP_LOADS, async () => {

    // load fabric base Controller
    addControllers({FwController});

    const openDSU = require("opendsu");
    const didAPI = openDSU.loadAPI("w3cdid");
    const scAPI = openDSU.loadAPI("sc");
    const typicalBusinessLogicHub = didAPI.getTypicalBusinessLogicHub();
    const onUserRemovedMessage = (message) => {
      $$.disableAlerts();
      typicalBusinessLogicHub.stop();
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

    typicalBusinessLogicHub.strongSubscribe(constants.MESSAGE_TYPES.USER_REMOVED, onUserRemovedMessage);
    // load Custom Components
    await import("../components/tab-navigator/dsu-tab-panel.js");
    await setupGlobalErrorHandlers();
  })

  addHook(constants.HOOKS.BEFORE_PAGE_LOADS, "home", async () => {
    const gtinResolver = require("gtin-resolver");
    const openDSU = require("opendsu");
    const scAPI = openDSU.loadAPI("sc");
    const w3cdid = openDSU.loadAPI("w3cdid");
    const LogService = gtinResolver.loadApi("services").LogService;

    await watchAndHandleExecution(async () => {
      let userRights = await utils.getUserRights();
      FwController.prototype.userRights = userRights;
      FwController.prototype.canWrite = () => {
        return userRights === constants.USER_RIGHTS.WRITE;
      };
    });

    let userGroupName = "-";

    try {
      let storageService = await $$.promisify(getSharedStorage)();
      FwController.prototype.storageService = storageService;

      const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
      let credential = await $$.promisify(mainEnclave.readKey)(constants.CREDENTIAL_KEY);
      let did = await $$.promisify(mainEnclave.readKey)(constants.IDENTITY_KEY);
      userGroupName = constants.DID_GROUP_MAP[credential.groupDID.slice(credential.groupDID.lastIndexOf(":") + 1)];
      let loginData = {
        userId: config.identity.name,
        action: "Access wallet",
        userDID: did,
        userGroup: userGroupName
      }

      let logService = new LogService(constants.LOGIN_LOGS_TABLE);
      if (!window.loggedIn) {
        logService.loginLog(loginData, (err, result) => {
          if (err) {
            console.log("Failed to audit wallet access:", err);
          }
        });
        window.loggedIn = true;
      }

      const didDomain = await $$.promisify(scAPI.getDIDDomain)();
      const groupDIDDocument = await $$.promisify(w3cdid.resolveDID)(`did:ssi:group:${didDomain}:ePI_Administration_Group`);
      let adminUserList;

      try {
        adminUserList = await $$.promisify(groupDIDDocument.listMembersByIdentity)();
        const memberDID_Document = await $$.promisify(w3cdid.resolveDID)(did);
        loginData.messageType = constants.MESSAGE_TYPES.USER_LOGIN;
        const crypto = require("opendsu").loadAPI("crypto");
        loginData.messageId = crypto.encodeBase58(crypto.generateRandom(32));
        for (let i = 0; i < adminUserList.length; i++) {
          let adminDID_Document = await $$.promisify(w3cdid.resolveDID)(adminUserList[i]);
          await $$.promisify(memberDID_Document.sendMessage)(JSON.stringify(loginData), adminDID_Document);
        }
      } catch (e) {
        console.log("Error sending login message to admins: ", e);
      }

    } catch (e) {
      console.log("Could not initialise properly FwController", e);
      $$.showErrorAlert("Could not initialise the app properly. It is a good idea to close all browser windows and try again!");
    }

    try {
      let disabledFeatures = await gtinResolver.DSUFabricFeatureManager.getDisabledFeatures();
      FwController.prototype.disabledFeatures = disabledFeatures;
    } catch (e) {
      console.log("Could not initialise properly FwController", e);
      $$.showErrorAlert("Could not initialise the app properly. It is a good idea to close all browser windows and try again!");
    }


  });

  define('epi-card', 'epi-card/template');
  define('page-template', {shadow: true});
  customElements.define("df-date-input", WebcDateInput);
}

if (config.identity.name) {
  //we finish the init only if proper user details retrieval was executed
  finishInit();
}
