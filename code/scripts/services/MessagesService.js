import constants from "../constants.js";
import AuditLogService from "./AuditLogService.js";
const mappings = require("gtin-resolver").loadApi("mappings");
const MessagesPipe = require("gtin-resolver").getMessagesPipe();

async function processMessages(messages, dsuStorage, callback) {
  if (!messages || messages.length === 0) {
    return;
  }
  const LogService = require("gtin-resolver").loadApi("services").LogService
  let logService = new LogService();
  const openDSU = require("opendsu");
  const config = openDSU.loadAPI("config");
  const domain = await $$.promisify(config.getEnv)("epiDomain");
  const subdomain = await $$.promisify(config.getEnv)("epiSubdomain")
  const anchoring = openDSU.loadAPI("anchoring");
  const anchoringx = anchoring.getAnchoringX();

  let mappingEngine, mappingLogService, auditLogService;
  try {
    const holderInfo = {
      domain,
      subdomain
    }
    mappingEngine = await $$.promisify(mappings.getEPIMappingEngine)({
      holderInfo: holderInfo,
      logService: logService
    });
    mappingLogService = mappings.getMappingLogsInstance(dsuStorage, logService);
    auditLogService = new AuditLogService(mappingLogService);
  } catch (e) {
    throw e;
  }

  return new Promise(function (resolve, reject) {
    try {

      const MessageQueuingService = require("gtin-resolver").loadApi("services").getMessageQueuingServiceInstance();
      let messagesPipe = new MessagesPipe(30, 2 * 1000, MessageQueuingService.getNextMessagesBlock);
      let digestedMessagesCounter = 0;
      let undigestedMessages = [];
      messagesPipe.onNewGroup(async (groupMessages) => {
        undigestedMessages = [...undigestedMessages, ...await mappingEngine.digestMessages(groupMessages)];
        digestedMessagesCounter += groupMessages.length;
        if (digestedMessagesCounter >= messages.length) {

          console.log("undigested messages ", undigestedMessages);
          await auditLogService.logUndigestedMessages(undigestedMessages);

          resolve(callback(undigestedMessages));
        }
      })

      messagesPipe.addInQueue(messages);

    } catch (err) {
      console.log("Error on digestMessages", err);
      reject(err)
    }
  });
}

export default {
  processMessages
}
