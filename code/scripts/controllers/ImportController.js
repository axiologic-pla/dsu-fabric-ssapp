import LogService from "../services/LogService.js";
import utils from "../utils.js";
import getSharedStorage from "../services/SharedDBStorageService.js";

const { WebcController } = WebCardinal.controllers;
const model = {
    filesChooser: {
        label: "Select files",
        accept: "json",
        listFiles: true,
        filesAppend: true,
        "event-name": "uploadProducts",
        "list-files": true
    },
    importIsDisabled:true,
    successfullyImportedLogs:[],
    failedImportedLogs:[]
}
export default class importController extends WebcController {
    constructor(...props) {
        const mappings = require("epi-utils").loadApi("mappings");
        super(...props);
        this.filesArray = [];
        this.model = model;


        this.on('uploadProducts', (event) => {
            this.filesArray = event.data || [];
            this.model.importIsDisabled = this.filesArray.length === 0;
        });

        this.onTagClick("import",()=>{
            if(this.filesArray.length === 0){
                return;
            }
            this.getMessagesFromFiles(this.filesArray).then(async (messages) => {
                this.logService = new LogService(this.DSUStorage);
              //TODO extract if... look into MangeProductController
              const holderInfo = {domain: "epi", subdomain: "default"};
              const mappingEngine = mappings.getEPIMappingEngine(this.DSUStorage, {
                holderInfo: holderInfo,
                logService: this.logService
              });
              const productMessages = messages.filter(msg => msg.messageType === "Product");
              const batchMessages = messages.filter(msg => msg.messageType === "Batch");
              try {
                let undigestedProdMsg;
                let undigestedBatchMsg;
                window.WebCardinal.loader.hidden=false;
                if (productMessages.length > 0) {
                  undigestedProdMsg = await mappingEngine.digestMessages(productMessages);
                }
                if (batchMessages.length > 0) {
                  undigestedBatchMsg = await mappingEngine.digestMessages(batchMessages);
                }

                console.log("Undigested messages: ", undigestedProdMsg, undigestedBatchMsg);
              } catch (err) {
                console.log("Error on digestMessages", err);
              }
              window.WebCardinal.loader.hidden=true;
              this.getImportLogs();
            });
        });

        this.getImportLogs();

    }

   async getMessagesFromFiles(files){
       let messages = [];
       let filesRead = 0;

       return new Promise((resolve, reject)=>{
           for(let i=0; i<files.length; i++){
               let file = files[i];

               let fileReader = new FileReader();
               fileReader.readAsText(file, "UTF-8");

               fileReader.onload = function (evt) {
                   let message;
                   try {
                       message = JSON.parse(evt.target.result);
                   }
                   catch (e) {
                       throw new Error("Message should be an object: " + e.message);
                   }
                   //TODO discuss if files can contain more than one message/product
                   if (Array.isArray(message)) {
                       for (let i = 0; i < message.length; i++) {
                           messages.push(message[i]);
                       }
                   } else {
                       messages.push(message);
                   }
                   filesRead++;
                   if(filesRead === files.length){
                       resolve(messages);
                   }
               }

               fileReader.onerror = function (evt) {
                   throw new Error("Error reading file")
               }
           }
       })
    }

    getImportLogs() {
        let successfullyImportedLogs = [];
        let failedImportedLogs = [];
        const storageService = getSharedStorage(this.DSUStorage);
        const getMappingLogs = require("epi-utils").loadApi("mappings").getMappingLogs(storageService);
        getMappingLogs((err, importLogs) => {
            if (err) {
                console.log(err);
            }
            importLogs.forEach(log => {
                if (log.message) {
                    log.timeAgo = utils.timeAgo(log.timestamp)
                    if (log.status === "success") {
                        successfullyImportedLogs.push(log);
                    } else {
                        failedImportedLogs.push(log);
                    }
                }
            });
            this.model.successfullyImportedLogs = successfullyImportedLogs.reverse();
            this.model.failedImportedLogs = failedImportedLogs.reverse();
        });
    }
}


