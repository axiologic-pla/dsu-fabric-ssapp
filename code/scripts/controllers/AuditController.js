const { WebcController } = WebCardinal.controllers;
import LogService from "../services/LogService.js";

export default class AuditController extends WebcController {
    constructor(element, history) {
        super(element, history);

        this.model = {};
        this.logService = new LogService(this.DSUStorage);

        this.model.addExpression('logListLoaded', () => {
            return typeof this.model.logs !== "undefined";
        }, 'logs');

        this.model.addExpression('listHeader', () => {
            return typeof this.model.logs !== "undefined" && this.model.logs.length > 0;
        }, 'logs');

        this.onTagClick('show-audit-entry', (model, target, event) => {
            const logData = model.allInfo;
            this.createWebcModal({
                template: 'show-audit-entry',
                disableExpanding: true,
                modalTitle: "Audit Entry",
                model: logData
            });
        });

        this.logService.getLogs((err, logs) => {

            function basicLogProcessing(item){
                return {
                    action:item.action,
                    username:item.username,
                    creationTime:item.creationTime,
                    allInfo: {
                        keySSI:item.keySSI,
                        all:JSON.stringify(item),
                        }
                    };
            }

            function productLogProcessing(item){
                let le = basicLogProcessing(item);

                le.action = `${item.action} ${item.logInfo.name} [${item.logInfo.gtin}] `;
                le.creationTime = item.logInfo.creationTime;
                le.keySSI = item.logInfo.keySSI;

                return le;
            }

            function batchLogProcessing(item){
                let le = productLogProcessing(item);
                le.action = `${item.action} ${item.logInfo.batchNumber} [${item.logInfo.gtin}] version ${item.logInfo.version}`;
                return le;
            }

            if (typeof logs === "undefined" || logs === null) {
                logs = [];
            }

            this.model.logs = logs.map( (item, index) => {
                let viewLog;
                try{
                    switch(item.logType){
                        case "PRODUCT_LOG":
                            viewLog = productLogProcessing(item);
                            break;
                        case "BATCH_LOG":
                            viewLog = batchLogProcessing(item);
                            break;
                        default:
                            viewLog = basicLogProcessing(item);
                    }
                } catch(err){
                    viewLog = basicLogProcessing(item);
                }
                return viewLog;
            });
        })
    }
}
