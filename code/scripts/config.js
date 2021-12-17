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

addHook('beforePageLoads', 'generate-did', () => {
  WebCardinal.root.disableHeader = true;
});

addHook('whenPageClose', 'generate-did', () => {
  WebCardinal.root.disableHeader = false;
});

define('dsu-leaflet', 'leaflet-component/dsu-leaflet');
define('page-template', {shadow: true});
