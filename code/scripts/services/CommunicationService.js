import constants from "../controllers/constants.js";

function CommunicationService(dsuStorage) {
  let isWaitingForMessage = false;

  this.waitForMessage = (callback) => {
    if (isWaitingForMessage) {
      return callback();
    }
    const openDSU = require("opendsu");
    const scAPI = openDSU.loadAPI("sc");
    dsuStorage.getObject(constants.WALLET_DID_PATH, async (err, didObj) => {
      if (err) {
        return callback(err);
      }
      const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
      let did = await $$.promisify(mainEnclave.resolveDID)(didObj.did);
      let message;
      isWaitingForMessage = true;
      try {
        message = await $$.promisify(did.readMessage)();
      } catch (e) {
        return this.waitForMessage(dsuStorage);
      }
      isWaitingForMessage = false;
      message = JSON.parse(message);
      await $$.promisify(dsuStorage.setObject.bind(dsuStorage))(
        constants.WALLET_CREDENTIAL_FILE_PATH,
        {
          credential: message.credential,
        }
      );
      const mainDSU = await $$.promisify(scAPI.getMainDSU)();
      let env = await $$.promisify(mainDSU.readFile)("/environment.json");
      env = JSON.parse(env.toString());
      env[openDSU.constants.SHARED_ENCLAVE.TYPE] = message.enclave.enclaveType;
      env[openDSU.constants.SHARED_ENCLAVE.DID] = message.enclave.enclaveDID;
      env[openDSU.constants.SHARED_ENCLAVE.KEY_SSI] =
        message.enclave.enclaveKeySSI;
      await $$.promisify(mainDSU.refresh)();
      await $$.promisify(mainDSU.writeFile)(
        "/environment.json",
        JSON.stringify(env)
      );
      scAPI.refreshSecurityContext();
      callback(undefined);
    });
  };
}

const getCommunicationService = (dsuStorage) => {
  if (!$$.communicationService) {
    $$.communicationService = new CommunicationService(dsuStorage);
  }

  return $$.communicationService;
};

export { getCommunicationService };
