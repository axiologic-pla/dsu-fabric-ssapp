import utils from "../utils.js";
import getSharedStorage from "../services/SharedDBStorageService.js";
import HolderService from "../services/HolderService.js";

const { WebcController } = WebCardinal.controllers;
const model = {
    selectedTab:0,
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
        const MessagesPipe = require("epi-utils").getMessagesPipe();
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
              const LogService = require("epi-utils").loadApi("services").LogService
              let logService = new LogService(this.DSUStorage);

              let mappingEngine;
              try {
                  const holderService = HolderService.getHolderService();
                  const holderInfo = await $$.promisify(holderService.ensureHolderInfo.bind(holderService.ensureHolderInfo))();
                  mappingEngine = mappings.getEPIMappingEngine(this.DSUStorage, {
                      holderInfo: holderInfo,
                      logService: logService
                  });
              }
              catch (e){
                  printOpenDSUError(createOpenDSUErrorWrapper("Invalid configuration detected!", e));
                  this.showErrorModalAndRedirect("Invalid configuration detected! Configure your wallet properly in the Holder section!", "import");
              }

              try {

                 window.WebCardinal.loader.hidden=false;

                 const MessageQueuingService = require("epi-utils").loadApi("services").getMessageQueuingServiceInstance();
                 let messagesPipe = new MessagesPipe(30, 2*1000, MessageQueuingService.getNextMessagesBlock);

                  messagesPipe.onNewGroup(async (groupMessages) => {
                      let undigestedMessages = await mappingEngine.digestMessages(groupMessages);

                      console.log(undigestedMessages);
                      window.WebCardinal.loader.hidden=true;
                      this.getImportLogs();

                      if (undigestedMessages.length === 0) {
                          this.model.selectedTab = 0;
                      } else {
                          this.model.selectedTab = 1;
                      }
                  })

                  messagesPipe.addInQueue(messages);

              } catch (err) {
                console.log("Error on digestMessages", err);
              }
            });
        });

        this.onTagClick("view-message", (model, target, event) => {
            this.model.actionModalModel = {
                title: "Message",
                messageData: JSON.stringify(model.message, null, 4),
                denyButtonText: 'Close',
                acceptButtonText: "Download"
            }

            this.showModalFromTemplate('view-message-modal',
              () => {
                  let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(model.message));
                  let downloadAnchorNode = document.createElement('a');
                  downloadAnchorNode.setAttribute("href", dataStr);
                  downloadAnchorNode.setAttribute("download", model.itemType + "_"+ model.itemCode +".json");
                  document.body.appendChild(downloadAnchorNode); // required for firefox
                  downloadAnchorNode.click();
                  downloadAnchorNode.remove();
              }, () => {
                  return
              }, {model: this.model});
        })

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
            let now = Date.now();
            importLogs.forEach(log => {
                if (log.message) {
                    log.timeAgo = utils.timeAgo(log.timestamp)
                    log.isFresh = now - log.timestamp < 60 * 1000;
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


