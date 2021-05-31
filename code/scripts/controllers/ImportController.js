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
    importProductsLogs:[],
    importBatchesLogs:[]
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
            this.getMessagesFromFiles(this.filesArray).then((messages) => {
                this.logService = new LogService(this.DSUStorage);
                //TODO extract if... look into MangeProductController
                const holderInfo = {domain: "epi", subdomain: "default"};
                const mappingEngine = mappings.getEPIMappingEngine(this.DSUStorage, {
                    holderInfo: holderInfo,
                    logService: this.logService
                });

                mappingEngine.digestMessages(messages).then(undigestedMessages => {
                    console.log(undigestedMessages);
                    this.getImportLogs();

                }).catch(err => {
                    console.log(err);
                })

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

     getImportLogs(){
        let importProductsLogs = [];
        let importBatchesLogs = [];
        const storageService = getSharedStorage(this.DSUStorage);
        const getMappingLogs = require("epi-utils").loadApi("mappings").getMappingLogs(storageService);
        getMappingLogs((err, importLogs)=>{
            if(err){
                console.log(err);
            }
            importLogs.forEach(log=>{
                if(log.message){
                    if(typeof log.message.product === "object"){
                        log.timeAgo  = utils.timeAgo (log.timestamp)
                        importProductsLogs.push(log);
                    }

                    if(typeof log.message.batch === "object"){
                        importBatchesLogs.push(log);
                    }
                }
            });
            this.model.importProductsLogs = importProductsLogs.reverse();
            this.model.importBatchesLogs = importBatchesLogs.reverse();
        });
    }
}


