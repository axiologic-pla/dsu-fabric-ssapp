import utils from "./utils.js";
import getSharedStorage from "./services/SharedDBStorageService.js";

const {define} = WebCardinal.components;
const {setConfig, getConfig, addHook, addControllers} = WebCardinal.preload;
const {FwController} = await import("./controllers/FwController.js");

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

addHook('beforePageLoads', 'generate-did', () => {
  WebCardinal.root.disableHeader = true;
});

addHook('whenPageClose', 'generate-did', () => {
  WebCardinal.root.disableHeader = false;
});

addHook("beforeAppLoads", async () => {
  // load fabric base Controller
  addControllers({FwController});
})

addHook("beforePageLoads", "home", async () => {
  try {
    let storageService = await $$.promisify(getSharedStorage)();
    FwController.prototype.storageService = storageService;
  } catch (e) {
    console.log("Could not initialise properly FwController", e);
  }
  try {
    let userRights = await utils.getUserRights();
    FwController.prototype.userRights = userRights;
  } catch (e) {
    console.log("Could not initialise properly FwController", e);
  }
  try {
    const gtinResolver = require("gtin-resolver");
    let disabledFeatures = await gtinResolver.DSUFabricFeatureManager.getDisabledFeatures();
    FwController.prototype.disabledFeatures = disabledFeatures;
  } catch (e) {
    console.log("Could not initialise properly FwController", e);
  }
});

define('dsu-leaflet', 'leaflet-component/dsu-leaflet');
define('page-template', {shadow: true});
