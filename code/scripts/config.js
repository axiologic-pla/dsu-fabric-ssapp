import utils from "./utils.js";
import constants from "./constants.js";
import getSharedStorage from "./services/SharedDBStorageService.js";

const {define} = WebCardinal.components;
const {setConfig, getConfig, addHook, addControllers} = WebCardinal.preload;
const {FwController} = await import("./controllers/FwController.js");

async function initializeWebCardinalConfig() {
  const config = getConfig();
  let userDetails;
  try{
    userDetails = await utils.getUserDetails();
  }catch(err) {
    if (window.confirm("Looks that your application is not properly initialized or in an invalid state. Would you like to reset it?")) {
      try {
        const response = await fetch("/removeSSOSecret/DSU_Fabric", {
          method: "DELETE",
          cache: "no-cache"
        })
        if (response.ok) {
          window.disableRefreshSafetyAlert = true;
          const basePath = window.location.href.split("loader")[0];
          window.location.replace(basePath + "loader/newWallet.html");
        } else {
          let er = new Error(`Reset request failed (${response.status})`);
          er.rootCause = `statusCode: ${response.status}`;
          throw er;
        }
      } catch (err) {
        alert(`Failed to reset the application. RootCause: ${err.message}`);
      }
    } else {
      alert(`Application is an desired state! Contact support!`);
    }
  }

  config.identity = {
    avatar: "assets/images/user.png"
  }

  if(userDetails){
    config.identity.name = userDetails.username;
    config.identity.email = userDetails.company;
  }

  return config;
}

let config = await initializeWebCardinalConfig();

function finishInit(){
  setConfig(config);

  addHook('beforePageLoads', 'generate-did', () => {
    WebCardinal.root.disableHeader = true;
  });

  addHook('whenPageClose', 'generate-did', () => {
    WebCardinal.root.disableHeader = false;
  });

  addHook("beforeAppLoads", async () => {
    // load fabric base Controller
    addControllers({FwController});

    const openDSU = require("opendsu");
    const didAPI = openDSU.loadAPI("w3cdid");
    const scAPI = openDSU.loadAPI("sc");
    const typicalBusinessLogicHub = didAPI.getTypicalBusinessLogicHub();
    const onUserRemovedMessage = (message) => {
      scAPI.getMainEnclave(async (err, mainEnclave) => {
        if (err) {
          console.log(err);
        }

        await $$.promisify(mainEnclave.writeKey)(constants.CREDENTIAL_KEY, constants.CREDENTIAL_DELETED);
        await $$.promisify(scAPI.deleteSharedEnclave)();
        scAPI.refreshSecurityContext();
        window.disableRefreshSafetyAlert = true;
        window.location.reload();
        return $$.history.go("generate-did");
      })
    }

    typicalBusinessLogicHub.strongSubscribe(constants.MESSAGE_TYPES.USER_REMOVED, onUserRemovedMessage);
    // load Custom Components
    await import("../components/tab-navigator/dsu-tab-panel.js");
  })

  addHook("beforePageLoads", "home", async () => {
    const gtinResolver = require("gtin-resolver");
    const openDSU = require("opendsu");
    const scAPI = openDSU.loadAPI("sc");
    const w3cdid = openDSU.loadAPI("w3cdid");
    const LogService = gtinResolver.loadApi("services").LogService;
    let userRights = await utils.getUserRights();
    let userGroupName = "-";
    FwController.prototype.userRights = userRights;
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
      alert("Could not initialise the app properly. Contact support!");
    }

    try {

      let disabledFeatures = await gtinResolver.DSUFabricFeatureManager.getDisabledFeatures();
      FwController.prototype.disabledFeatures = disabledFeatures;
    } catch (e) {
      console.log("Could not initialise properly FwController", e);
      alert("Could not initialise the app properly. Contact support!");
    }
  });

  define('dsu-leaflet', 'leaflet-component/dsu-leaflet');
  define('page-template', {shadow: true});
}

if(config.identity.name){
  //we finish the init only if proper user details retrieval was executed
  finishInit();
}