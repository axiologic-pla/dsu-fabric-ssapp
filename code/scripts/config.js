const { define } = WebCardinal.components;

const { setConfig, getConfig} = WebCardinal.preload;
import utils from "./utils.js";
async function initializeWebCardinalConfig() {
    const config = getConfig();
    const userDetails = await utils.getUserDetails();
    config.identity = {
        avatar:"assets/images/user.png",
        name: userDetails.username,
        email: userDetails.company
    }
    return config;
}

const config = await initializeWebCardinalConfig();
console.log(config);
setConfig(config);

define('dsu-leaflet', 'leaflet-component/dsu-leaflet');
