import constants from "../constants.js";

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

  let mappingEngine, mappingLogService;
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
          for (let i = 0; i < messages.length; i++) {
            let undigestedMessage = undigestedMessages.find(uMsg => uMsg.message.messageId === messages[i].messageId);
            if (undigestedMessage) {
              let errorStatus = undigestedMessage.error.debug_message || null;
              if (undigestedMessage.error && undigestedMessage.error.otherErrors && undigestedMessage.error.otherErrors.details.length) {
                mappingLogService.logFailAction(undigestedMessage.message, undigestedMessage.error.otherErrors.details, errorStatus)
              } else {
                mappingLogService.logFailAction(undigestedMessage.message, undigestedMessage.error, errorStatus)
              }
            } else {
              let auditId = messages[i].messageId + "|" + messages[i].senderId + "|" + messages[i].messageDateTime;
              let auditRecord = {hashLink: "unknown hashLink"}
              try {
                let dbResult = await $$.promisify(dsuStorage.filter, dsuStorage)(constants.LOGS_TABLE, `auditId == ${auditId}`, "dsc");
                if (dbResult && dbResult.length > 0) {
                  auditRecord = dbResult[0];
                  auditRecord.hashLink = await $$.promisify(anchoringx.getLastVersion)(auditRecord.anchorId);
                }
              } catch (e) {
                auditRecord.hashLink = "error on getting hashLink: " + e.message;
              }
              await $$.promisify(dsuStorage.updateRecord, dsuStorage)(constants.LOGS_TABLE, auditRecord.pk, auditRecord);

            }
          }

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
