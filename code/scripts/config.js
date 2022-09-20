import utils from "./utils.js";

const {define} = WebCardinal.components;
const {setConfig, getConfig, addHook} = WebCardinal.preload;

async function initializeWebCardinalConfig() {
  const config = getConfig();
  const userDetails = await utils.getUserDetails();
  config.identity = {
    avatar: "assets/images/user.png",
    name: userDetails.username,
    email: userDetails.company
  }
  return config;
}

const config = await initializeWebCardinalConfig();
setConfig(config);

addHook("afterAppLoads", async () => {
  const openDSU = require("opendsu");
  const w3cdid = openDSU.loadAPI("w3cdid");
  const scAPI = openDSU.loadAPI("sc");
  const groupDIDDocument = await $$.promisify(w3cdid.resolveDID)("did:ssi:group:vault:ePI_Administration_Group");
  let adminUserList;
  const dsuMainEnclave = await $$.promisify(scAPI.getMainEnclave)();
  let did;
  try {
    did = await $$.promisify(dsuMainEnclave.readKey)("did");
  } catch (e) {
    console.log("Failed to read DID for logging logged in user ", e);
    return;
  }

  try {
    adminUserList = await $$.promisify(groupDIDDocument.listMembersByIdentity)();
    const memberDID_Document = await $$.promisify(w3cdid.resolveDID)(did);
    const msg = {
      messageType: "UserLogin",
      userDID: did,
      userType: "epiWrite",
      messageId: `${new Date().getTime()}|${did}`
    };
    for (let i = 0; i < adminUserList.length; i++) {
      let adminDID_Document = await $$.promisify(w3cdid.resolveDID)(adminUserList[i]);
      await $$.promisify(memberDID_Document.sendMessage)(JSON.stringify(msg), adminDID_Document);
    }
  } catch (e) {
    console.log("Error sending login message to admins: ", e);
  }

  /*
  // log in dsu audit log user login action

  const LogService = require("gtin-resolver").loadApi("services").LogService;
  let logService = new LogService();
  const userDetails = await utils.getUserDetails();
  console.log("Could not update audit log for user login. ");
    return logService.log({
      logInfo: {
        name: userDetails.username,
        email: userDetails.company
      },
      username: userDetails.username,
      reason: `Logged in`,
      metadata: "Logged in"
    }, (err, result) => {
      if (err) {
        console.log("Could not update audit log for user login. ", err);
      }
      return;
    })*/
})

addHook('beforePageLoads', 'generate-did', () => {
  WebCardinal.root.disableHeader = true;
});

addHook('whenPageClose', 'generate-did', () => {
  WebCardinal.root.disableHeader = false;
});

define('dsu-leaflet', 'leaflet-component/dsu-leaflet');
define('page-template', {shadow: true});
