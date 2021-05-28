import LogService from "../services/LogService.js";

const { WebcController } = WebCardinal.controllers;
const messages = [{
    "messageType" : "Product",

    "messageTypeVersion" : 0.1,
    "senderId" : "NOVARTIS_P75_010",
    "receiverId" : "ePI_DSU_NOVARTIS",
    "messageId" : "00012856374589",
    "messageDateTime" : "2021-04-27T10:12:12CET",
    "product" : {
        "productCode" : "05596791488128",
        "internalMaterialCode" : "100200",
        "inventedName" : "Ritalin",
        "nameMedicinalProduct" : "Ritalin LA HGC 40mg 1x30",
        "strength" : "40mg",
        "flagEnableAdverseEventReporting" : false,
        "adverseEventReportingURL" : "",
        "flagEnableACFProductCheck" : false,
        "acfProductCheckURL" : "",
        "flagDisplayEPI_BatchRecalled" : false,
        "flagDisplayEPI_SNRecalled" : true,
        "flagDisplayEPI_SNDecommissioned" : true,
        "flagDisplayEPI_SNUnknown" : true,
        "flagDisplayEPI_EXPIncorrect" : true,
        "flagDisplayEPI_BatchExpired" : true,
        "patientSpecificLeaflet" : "",
        "healthcarePractitionerInfo" : "",
        "markets" : [
            {
                "marketId" : "DE",
                "nationalCode" : "1234567",
                "mahName" : "Novartis",
                "legalEntityName" : "Novartis Deutschland AG"
            },
            {
                "marketId" : "AT",
                "nationalCode" : "23456",
                "mahName" : "Novartis",
                "legalEntityName" : "Novartis Österreich AG"
            }
        ]
    }
}];
const model = {
    filesChooser: {
        label: "Select files",
        accept: "json",
        listFiles: true,
        filesAppend: true,
        files: []
    }
}
export default class batchesController extends WebcController {
    constructor(...props) {
        const mappings = require("epi-utils").loadApi("mappings");

        super(...props);
        this.model = model;

        this.model.onChange('filesChooser', () => {
            let filesArray = this.model.filesChooser.files || [];
        });
        this.on('add-file-folder', (event) => {
            let filesArray = event.data || [];
        });
        this.logService = new LogService(this.DSUStorage);
        //TODO extract if... look into MangeProductController
        const holderInfo = {domain:"epi", subdomain:"default"};
        const mappingEngine = mappings.getEPIMappingEngine(this.DSUStorage,{holderInfo:holderInfo,logService:this.logService});

        mappingEngine.digestMessages(messages).then(undigestedMessages=>{

            console.log(undigestedMessages);




        }).catch(err=>{
            console.log(err);
        })

    }
}


