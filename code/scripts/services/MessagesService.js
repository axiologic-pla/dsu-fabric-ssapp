import AuditLogService from "./AuditLogService.js";

const mappings = require("gtin-resolver").loadApi("mappings");
const MessagesPipe = require("gtin-resolver").getMessagesPipe();

async function getHolderInfo() {
    const openDSU = require("opendsu");
    const config = openDSU.loadAPI("config");
    const domain = await $$.promisify(config.getEnv)("epiDomain");
    const subdomain = await $$.promisify(config.getEnv)("epiSubdomain")

    return {
        domain,
        subdomain
    };
}

async function logFailedMessages(messages, dsuStorage, callback){
    if (!messages || messages.length === 0) {
        return;
    }
    const LogService = require("gtin-resolver").loadApi("services").LogService;

    let mappingLogService, auditLogService;
    try {
        mappingLogService = mappings.getMappingLogsInstance(dsuStorage, new LogService());
        auditLogService = new AuditLogService(mappingLogService);
        await auditLogService.logUndigestedMessages(messages);
    } catch (e) {
        return callback(e);
    }

    callback(undefined);
}

function skipMessages(messages){
    let undigestedMessages = [];
    for(let message of messages){
        undigestedMessages.push({message: message, error:"skipped because of previous errors"});
    }
    return undigestedMessages;
}

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
                try {
                    undigestedMessages = [...undigestedMessages, ...await mappingEngine.digestMessages(groupMessages)];
                } catch (err) {
                    reject(err);
                }

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

async function processMessagesWithoutGrouping(messages, dsuStorage, callback) {
    const LogService = require("gtin-resolver").loadApi("services").LogService;
    let logService = new LogService();
    const openDSU = require("opendsu");
    const config = openDSU.loadAPI("config");
    const domain = await $$.promisify(config.getEnv)("epiDomain");
    const subdomain = await $$.promisify(config.getEnv)("epiSubdomain")

    let mappingEngine;
    try {
        const holderInfo = {
            domain,
            subdomain
        }
        mappingEngine = await $$.promisify(mappings.getEPIMappingEngine)({
            holderInfo: holderInfo,
            logService: logService
        });
    } catch (e) {
        return callback(e);
    }

    let undigestedMessages = [];
    let error;
    try {
        undigestedMessages = await mappingEngine.digestMessages(messages);
        console.log("undigested messages ", undigestedMessages);
    } catch (err) {
        console.log("Error on digestMessages", err);
        undigestedMessages.concat(skipMessages(messages));
        error = err;
    }
    callback(error, undigestedMessages);
}


async function digestMessagesOneByOne(messages, dsuStorage, callback) {
    let undigestedMessages = [];
    const LogService = require("gtin-resolver").loadApi("services").LogService;
    let logService = new LogService();

    let options = {
        logService: logService
    };
    let mappingEngine;

    try {
        options.holderInfo = await getHolderInfo();
        mappingEngine = await $$.promisify(mappings.getEPIMappingEngine)(options);

    } catch (err) {
        return callback(err, messages);
    }

    let undigested = [];
    async function process(message) {
        if (!message) {
            //this is the end of it!!!
            return callback(undefined, undigestedMessages);
        }

        try{
            undigested = await mappingEngine.digestMessages(message);
        }catch(err){
            return callback(err, undigestedMessages.concat(skipMessages(messages)));
        }

        undigestedMessages = undigestedMessages.concat(undigested);
        return process(messages.shift());
    }

    process(messages.shift());
}

export default {
    logFailedMessages,
    processMessages,
    digestMessagesOneByOne,
    processMessagesWithoutGrouping
}
