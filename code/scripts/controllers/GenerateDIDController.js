import ContainerController from "../../cardinal/controllers/base-controllers/ContainerController.js";
import constants from "./constants.js";
import {copyToClipboard} from "../helpers/document-utils.js";

export default class GenerateDIDController extends ContainerController {
    constructor(element, history) {
        super(element, history);

        this.setModel({});
        const openDSU = require("opendsu");
        const w3cDID = openDSU.loadAPI("w3cdid");
        const scAPI = openDSU.loadAPI("sc");
        const crypto = openDSU.loadAPI("crypto");
        setTimeout(async () => {
            debugger

            const userDetails = await this.getUserDetails();
            const vaultDomain = await $$.promisify(scAPI.getVaultDomain)();
            const identity = await $$.promisify(w3cDID.createIdentity)("name", vaultDomain, userDetails.username);
            this.model.identity = identity.getIdentifier();
            let did;
            try {
                did = await $$.promisify(this.DSUStorage.getObject.bind(this.DSUStorage))(constants.WALLET_DID_PATH)
            } catch (e) {}

            if(!did){
                await $$.promisify(this.DSUStorage.setObject.bind(this.DSUStorage))(constants.WALLET_DID_PATH, {did: this.model.identity});

                identity.readMessage(async (err, message) => {
                    console.log("message ", crypto.decodeBase58(message).toString());
                    message = JSON.parse(crypto.decodeBase58(message).toString());
                    this.DSUStorage.setObject(constants.WALLET_CREDENTIAL_FILE_PATH, {credential: message.credential}, async (err)=>{
                        console.log("err", err);
                        const cred = await $$.promisify(this.DSUStorage.getObject.bind(this.DSUStorage))(constants.WALLET_CREDENTIAL_FILE_PATH)
                        const mainDSU = await $$.promisify(scAPI.getMainDSU)();
                        const keySSI = await $$.promisify(mainDSU.getKeySSIAsString)()
                        let env = await $$.promisify(mainDSU.readFile)("/environment.json");
                        env = JSON.parse(env.toString());
                        debugger
                        env[openDSU.constants.ENCLAVE_TYPE] = message.enclave.enclaveType;
                        env[openDSU.constants.ENCLAVE_DID] = message.enclave.enclaveDID;
                        env[openDSU.constants.ENCLAVE_KEY_SSI] = message.enclave.enclaveKeySSI;
                        debugger
                        await $$.promisify(mainDSU.writeFile)("/environment.json", JSON.stringify(env));
                        // await $$.promisify(config.setEnv)(openDSU.constants.ENCLAVE_TYPE, message.enclaveType);
                        // await $$.promisify(config.setEnv)(openDSU.constants.ENCLAVE_DID, message.enclaveDID);
                        scAPI.refreshSecurityContext();
                        console.log(message.credential);
                        history.push("/home");
                    })
                    // await $$.promisify(this.DSUStorage.setObject.bind(this.DSUStorage))(constants.WALLET_CREDENTIAL_FILE_PATH, {credential: message.credential});

                })
                return;
            }

            history.push("/home");
        });

        this.on("copy-text", (event) => {
            copyToClipboard(event.data);
        });
    }

    async getUserDetails() {
        try {
            const response = await fetch("/api-standard/user-details");
            return await response.json();
        } catch (err) {
            console.error(`Failed to get user's details`, err);
            return {};
        }
    }
}