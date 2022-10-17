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

  async exportToCSV(data) {
    let exportData = data;
    if (!exportData) {
      let allData = await $$.promisify(this.storageService.filter, this.storageService)(this.tableName, `__timestamp > 0`, "dsc");
      exportData = this.getMappedResult(allData);
    }
    //prepare column titles
    let titles = Object.keys(exportData[0]);
    let columnTitles = titles.join(",") + "\n";
    let rows = "";

    exportData.forEach(item => {
      let row = "";
      titles.forEach(colTitle => {
        if ("details" === colTitle) {
          let details = JSON.parse(item[colTitle].all);
          if (details.diffs && Object.keys(details.diffs).length > 0) {
            row += "diffs: " + JSON.stringify(details.diffs).replace(/,/g, ";") + ";";
          }
          if (details.logInfo && Object.keys(details.logInfo).length > 0) {
            row += "logInfo: " + JSON.stringify(details.logInfo).replace(/,/g, ";") + ";";
          }
          if (details.anchorId) {
            row += "anchorId:" + details.anchorId + ";";
          }
          if (details.hashLink) {
            row += "hashLink:" + details.hashLink + ";";
          }
          row += ",";
        } else {
          row += item[colTitle] + ",";
        }
      })
      rows += row + "\n";
    })

    let csvBlob = new Blob([columnTitles + rows], {type: "text/csv"});
    return csvBlob;
  }

  basicLogProcessing(item) {
    return {
      gtin: item.metadata ? item.metadata.gtin || "-" : "-",
      batch: "-",
      reason: item.reason,
      username: item.username,
      creationTime: item.creationTime || new Date(item.timestamp).toISOString(),
      details: {
        all: JSON.stringify(item),
      }
    };
  }

  attachmentLogProcessing(item) {
    let attachmentLog = this.basicLogProcessing(item);
    if (item.metadata && item.metadata.attachedTo && item.metadata.attachedTo === "BATCH") {
      attachmentLog.batch = `${item.itemCode}`;
    }
    return attachmentLog;
  }

  productLogProcessing(item) {
    let le = this.basicLogProcessing(item);
    return le;
  }

  batchLogProcessing(item) {
    let le = this.productLogProcessing(item);
    le.batch = `${item.itemCode}`
    return le;
  }

  getMappedResult(data) {
    this.currentViewData = data.map((item, index) => {
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
            break;
          default:
            viewLog = this.basicLogProcessing(item);
        }
      } catch (err) {
        viewLog = this.basicLogProcessing(item);
      }
      return viewLog;
    });
    return this.currentViewData;
  }

}

export default class AuditController extends WebcController {
  constructor(...props) {
    super(...props);

    this.model = {};
    getSharedStorage((err, storageService) => {
      if (err) {
        throw err;
      }

      this.storageService = storageService;
      this.model.auditDataSource = new AuditDataSource({
        storageService: this.storageService, tableName: constants.LOGS_TABLE, searchField: "gtin"
      });
      getCommunicationService(this.DSUStorage).waitForMessage(this, () => {
      });

      lazyUtils.attachHandlers(this, "auditDataSource");

      this.onTagClick("audit-export", async (model, target, event) => {
        let csvResult = await this.model.auditDataSource.exportToCSV();
        let url = window.URL.createObjectURL(csvResult);
        let anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "audit.csv";
        anchor.click();
        window.URL.revokeObjectURL(url);
        anchor.remove();
      })

      this.onTagClick('show-audit-entry', (model, target, event) => {

        let cleanObject = function JSONstringifyOrder(obj) {
          const objToDisplay = {};
          let displayKeys = ["username", "reason", "itemCode", "diffs", "anchorId", "hashLink", "logInfo", "metadata"];
          displayKeys.forEach(key => {
            objToDisplay[key] = obj[key];
          })

          return objToDisplay
        }

        const formattedJSON = JSON.stringify(cleanObject(JSON.parse(model.details.all)), null, 4);
        this.model.actionModalModel = {
          title: "Audit Entry", messageData: formattedJSON, denyButtonText: 'Close', acceptButtonText: "Download"
        }

        this.showModalFromTemplate('show-audit-entry', () => {
          let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(formattedJSON);
          let downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href", dataStr);
          downloadAnchorNode.setAttribute("download", model.reason + ".json");
          document.body.appendChild(downloadAnchorNode); // required for firefox
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
        }, () => {

        }, {model: this.model});

      });
    });
  }
}
