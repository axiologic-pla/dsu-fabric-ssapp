import constants from "../controllers/constants.js";

function CommunicationService(dsuStorage) {
  let isWaitingForMessage = false;

  this.waitForMessage = async (pageContext, callback) => {
    if (isWaitingForMessage) {
      return callback();
    }
    const openDSU = require("opendsu");
    const scAPI = openDSU.loadAPI("sc");
    const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
    mainEnclave.readKey("did", async (err, _did) => {
      if (err) {
        return callback(err);
      }

      let did = await $$.promisify(mainEnclave.resolveDID)(_did);
      let message;
      isWaitingForMessage = true;
      try {
        message = await $$.promisify(did.readMessage)();
      } catch (e) {
        isWaitingForMessage = false;
        return this.waitForMessage(dsuStorage, callback);
      }
      isWaitingForMessage = false;
      message = JSON.parse(message);
      const mainDSU = await $$.promisify(scAPI.getMainDSU)();
      if (message.messageType === "RemoveMembersFromGroup" || message.messageType === "DeactivateMember") {
        try {
          await $$.promisify(mainEnclave.writeKey)("credential", "deleted");
          await $$.promisify(scAPI.deleteSharedEnclave)();
          await $$.promisify(mainDSU.refresh)();
          scAPI.refreshSecurityContext();
          return pageContext.history.go("generate-did");
          callback(undefined);
        } catch (err) {
          console.log("Error on delete wallet ", err);
        }

      } else {
        await $$.promisify(mainEnclave.writeKey)("credential", message.credential);
        /*        await $$.promisify(dsuStorage.setObject.bind(dsuStorage))(
                  constants.WALLET_CREDENTIAL_FILE_PATH,
                  {
                    credential: message.credential,
                  }
                );*/

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
      }

    });
  };
}

const getCommunicationService = (dsuStorage) => {
  if (!$$.communicationService) {
    $$.communicationService = new CommunicationService(dsuStorage);
  }

  return $$.communicationService;
};

export {getCommunicationService};
