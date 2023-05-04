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

function logFailedMessages(messages, dsuStorage, callback){
    dsuStorage.failureAwareCommit(messages, callback);
}

async function _logFailedMessages(messages, dsuStorage, callback){
    if (!messages || messages.length === 0) {
        callback(undefined);
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

async function _acquireLock(identifier, period, attempts, timeout){
    const opendsu = require("opendsu");
    const utils = opendsu.loadApi("utils");
    const lockApi = opendsu.loadApi("lock");
    const crypto = opendsu.loadApi("crypto");
    let secret = crypto.encodeBase58(crypto.generateRandom(32));

    let lockAcquired;
    let noAttempts = attempts;
    while(noAttempts>0){
        noAttempts--;
        lockAcquired = await lockApi.lockAsync(identifier, secret, period);
        if(!lockAcquired){
            await utils.sleepAsync(timeout);
        }else{
            break;
        }
        if(noAttempts === 0){
            if (window.confirm("Other user is editing right now. Do you want to wait for him to finish?")) {
                noAttempts = attempts;
            }
        }
    }
    if (!lockAcquired) {
        secret = undefined;
    }

    return secret;
}

async function _releaseLock(identifier, secret){
    const opendsu = require("opendsu");
    const lockApi = opendsu.loadApi("lock");
    try{
        await lockApi.unlockAsync(identifier, secret);
    }catch(err){
        console.error("Failed to release lock", err);
    }
}

function getStorageService(dsuStorage) {
    if(dsuStorage.wrapped){
       return dsuStorage;
    }

    async function acquireLock(period, attempts, timeout){
        let identifier = await dsuStorage.getUniqueIdAsync();
        return await _acquireLock(identifier, period, attempts, timeout);
    }

    async function releaseLock(secret){
        let identifier = await dsuStorage.getUniqueIdAsync();
        await _releaseLock(identifier, secret);
    }


    let originalCommit = dsuStorage.commitBatch;
    let originalBegin = dsuStorage.beginBatch;
    let originalCancel = dsuStorage.cancelBatch;

    dsuStorage.commitBatch = function(forDID, callback){
        //originalCommit.call(dsuStorage, ...args);
        if(typeof forDID === "function"){
            callback = forDID;
            forDID = undefined;
        }
        callback();
    }

    dsuStorage.beginBatch = function(forDID){
        originalBegin.call(dsuStorage, forDID);
    }

    dsuStorage.cancelBatch = function(...args){
        originalCancel.call(dsuStorage, ...args);
    }

    dsuStorage.failureAwareCommit = async function(failedMessages, callback){
        let lock;
        let error;
        lock = await acquireLock(60000, 100, 500);
        if(!lock){
            callback(new Error("Not able to acquire lock to save the undigested messages."));
        }

        if(failedMessages.length){
            await $$.promisify(dsuStorage.cancelBatch)();

            try{
                await $$.promisify(dsuStorage.refresh, dsuStorage)();
                originalBegin.call(dsuStorage);
                await $$.promisify(_logFailedMessages)(failedMessages, dsuStorage);
            }catch(err){
                console.log(err);
                error = err;
            }
        }

        try{
            await $$.promisify(originalCommit, dsuStorage)();
        }catch(err){
            console.log(err);
            alert(err);
            error = err;
        }

        await releaseLock(lock);
        callback(error, undefined);
    }

    dsuStorage.wrapped = true;
    return dsuStorage;
}

function getEPIMappingEngine(sharedEnclave, options, callback) {
    if (typeof options === "function") {
        callback = options;
        options = undefined;
    }
    const openDSU = require("opendsu");

    const mappingEngine = openDSU.loadApi("m2dsu").getMappingEngine(sharedEnclave, options);
    return callback(undefined, mappingEngine);
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
        mappingEngine = await $$.promisify(getEPIMappingEngine)(dsuStorage, {
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
                let isForceRecovery = false;
                try {
                    undigestedMessages = [...undigestedMessages, ...await mappingEngine.digestMessages(groupMessages)];
                } catch (err) {
                    if(isForceRecovery){
                        $$.enableBrowserConfirm();
                    }
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
        mappingEngine = await $$.promisify(getEPIMappingEngine)(dsuStorage, {
            holderInfo: holderInfo,
            logService: logService
        });
    } catch (e) {
        return callback(e);
    }

    let undigestedMessages = [];
    let error;
    let isForceRecovery = false;
    try {
        if(messages.length && messages[0] && messages[0].force){
            isForceRecovery = true;
            $$.disableBrowserConfirm();
        }
        undigestedMessages = await mappingEngine.digestMessages(messages);
        if(isForceRecovery){
            $$.enableBrowserConfirm();
        }

        console.log("undigested messages ", undigestedMessages);
    } catch (err) {
        if(isForceRecovery){
            $$.enableBrowserConfirm();
        }
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
        mappingEngine = await $$.promisify(getEPIMappingEngine)(dsuStorage, options);

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
            let failedMessages = undigestedMessages.concat(skipMessages(messages));
            failedMessages.push(message);
            return callback(err, failedMessages);
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
    processMessagesWithoutGrouping,
    getStorageService,
    acquireLock:_acquireLock,
    releaseLock:_releaseLock
}

