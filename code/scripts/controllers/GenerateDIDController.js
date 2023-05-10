import {copyToClipboard} from "../helpers/document-utils.js";
import utils from "../utils.js";
import constants from "../constants.js";

const {WebcController} = WebCardinal.controllers;

const getUserDetails = utils.getUserDetails;
function GenerateDIDController(...props) {
    let self = new WebcController(...props)
    if (!$$.history) {
        $$.history = props[1];
    }
    self.model = {};

    const openDSU = require("opendsu");
    const w3cDID = openDSU.loadAPI("w3cdid");
    const scAPI = openDSU.loadAPI("sc");
    const typicalBusinessLogicHub = w3cDID.getTypicalBusinessLogicHub();
    const sc = scAPI.getSecurityContext();

    scAPI.getMainEnclave(async (err, mainEnclave) => {
        if (err) {
            console.log(err);
        }

        self.mainDSU = await $$.promisify(scAPI.getMainDSU)();
        self.mainEnclave = mainEnclave;
        let did;
        try {
            did = await $$.promisify(mainEnclave.readKey)(constants.IDENTITY_KEY);
        } catch (e) {
            console.log("DID not yet created");
        }

        if (!did) {
            did = await self.createDID();
        }

        await $$.promisify(typicalBusinessLogicHub.setMainDID)(did);
        const accessWasGranted = await self.accessWasGranted();
        if (accessWasGranted) {
            return self.authorizationIsDone();
        }

        self.denyAccess();
        typicalBusinessLogicHub.subscribe(constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP, self.onMessageReceived);

        self.model.identity = did;
        await self.mainEnclave.safeBeginBatchAsync();
        await $$.promisify(self.mainEnclave.writeKey)(constants.IDENTITY_KEY, self.model.identity);
        await self.mainEnclave.commitBatchAsync();
    })

    self.on("copy-text", (event) => {
        copyToClipboard(event.data);
    });

    self.accessWasGranted = async () => {
        let sharedEnclave;
        try {
            sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
        } catch (err) {
        }

        if (sharedEnclave) {
            let userRights;
            try{
                userRights = await utils.getUserRights();
            }catch(err){
                if(err.rootCause === "security"){
                    return false;
                }
                return $$.forceTabRefresh();
            }


            return true;
        }

        let credential;
        try {
            credential = await $$.promisify(self.mainEnclave.readKey)(constants.CREDENTIAL_KEY);
        } catch (e) {
        }

        if (credential && credential !== constants.CREDENTIAL_DELETED) {
            return true;
        }

        return false;
    }

    self.onMessageReceived = (message) => {
        self.mainEnclave.writeKey(constants.CREDENTIAL_KEY, message.credential, err => {
            if (err) {
                console.log(err);
            }

            self.setSharedEnclaveFromMessage(message)
                .then(() => {
                    self.authorizationIsDone();
                }).catch(console.log)
        })
    }

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

    self.setSharedEnclaveFromMessage = async (message) => {
        let env = await $$.promisify(self.mainDSU.readFile)("/environment.json");
        env = JSON.parse(env.toString());
        env[openDSU.constants.SHARED_ENCLAVE.TYPE] = message.enclave.enclaveType;
        env[openDSU.constants.SHARED_ENCLAVE.DID] = message.enclave.enclaveDID;
        env[openDSU.constants.SHARED_ENCLAVE.KEY_SSI] = message.enclave.enclaveKeySSI;
        await self.mainDSU.safeBeginBatchAsync();
        await $$.promisify(self.mainDSU.writeFile)("/environment.json", JSON.stringify(env));
        await self.mainDSU.commitBatchAsync();
        scAPI.refreshSecurityContext();
    }

    return self;
}

export default GenerateDIDController;