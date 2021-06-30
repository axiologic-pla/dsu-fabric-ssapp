const { WebcController } = WebCardinal.controllers;
import LogService from "../services/LogService.js";

export default class AuditController extends WebcController {
    constructor(...props) {
        super(...props);

        this.model = {};
        this.logService = new LogService(this.DSUStorage);

        this.model.addExpression('logListLoaded', () => {
            return typeof this.model.logs !== "undefined";
        }, 'logs');

        this.model.addExpression('listHeader', () => {
            return typeof this.model.logs !== "undefined" && this.model.logs.length > 0;
        }, 'logs');

        this.onTagClick('show-audit-entry', (model, target, event) => {

            const formattedJSON = JSON.stringify(JSON.parse(model.allInfo.all), null, 4);
            this.model.actionModalModel = {
                title: "Audit Entry",
                messageData: formattedJSON,
                denyButtonText: 'Close',
                acceptButtonText: "Download"
            }

            this.showModalFromTemplate('show-audit-entry',
                () => {
                    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(formattedJSON);
                    let downloadAnchorNode = document.createElement('a');
                    downloadAnchorNode.setAttribute("href", dataStr);
                    downloadAnchorNode.setAttribute("download", model.action +".json");
                    document.body.appendChild(downloadAnchorNode); // required for firefox
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();
                }, () => {

                }, {model: this.model});

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
