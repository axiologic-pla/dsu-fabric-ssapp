import {getCommunicationService} from "../services/CommunicationService.js";
import getSharedStorage from "../services/SharedDBStorageService.js";
import constants from "../constants.js";
import {LazyDataSource} from "../helpers/LazyDataSource.js";
import lazyUtils from "../helpers/lazy-data-source-utils.js"

const {WebcController} = WebCardinal.controllers;

class AuditDataSource extends LazyDataSource {
  constructor(...props) {
    super(...props);
  }

  basicLogProcessing(item) {
    return {
      action: item.action,
      username: item.username,
      creationTime: item.creationTime || new Date(item.timestamp).toLocaleString(),
      allInfo: {
        keySSI: item.keySSI,
        all: JSON.stringify(item),
      }
    };
  }

  attachmentLogProcessing(item) {
    let attachmentLog = this.basicLogProcessing(item);
    attachmentLog.target = `${item.metadata.attachedTo} - ${item.metadata.itemCode}`;
    return attachmentLog;
  }

  productLogProcessing(item) {
    let le = this.basicLogProcessing(item);
    le.target = `${item.logInfo.name} [${item.logInfo.gtin}] v. ${item.logInfo.version}`
    le.keySSI = item.logInfo.keySSI;

    return le;
  }

  batchLogProcessing(item) {
    let le = this.productLogProcessing(item);
    le.target = `${item.logInfo.batchNumber} [${item.logInfo.gtin}] v. ${item.logInfo.version}`
    return le;
  }

  getMappedResult(data) {
    return data.map((item, index) => {
      let viewLog;
      try {
        switch (item.logType) {
          case "PRODUCT_LOG":
            viewLog = this.productLogProcessing(item);
            break;
          case "BATCH_LOG":
            viewLog = this.batchLogProcessing(item);
            break;
          case "PRODUCT_PHOTO_LOG":
          case "LEAFLET_LOG":
          case "VIDEO_LOG":
            viewLog = this.attachmentLogProcessing(item);
            break;
          case "FAILED_LOG":
            viewLog = this.basicLogProcessing(item);
            viewLog.target = item.itemCode;
            break;
          default:
            viewLog = this.basicLogProcessing(item);
        }
      } catch (err) {
        viewLog = this.basicLogProcessing(item);
      }
      return viewLog;
    });
  }

}

export default class AuditController extends WebcController {
  constructor(...props) {
    super(...props);

    this.model = {};
    this.storageService = getSharedStorage(this.DSUStorage);
    this.model.auditDataSource = new AuditDataSource({
      storageService: this.storageService,
      tableName: constants.LOGS_TABLE,
      searchField: "itemCode"
    });
    getCommunicationService(this.DSUStorage).waitForMessage(() => {
    });

    lazyUtils.attachHandlers(this, "auditDataSource");
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
          downloadAnchorNode.setAttribute("download", model.action + ".json");
          document.body.appendChild(downloadAnchorNode); // required for firefox
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
        }, () => {

        }, {model: this.model});

    });

  }
}
