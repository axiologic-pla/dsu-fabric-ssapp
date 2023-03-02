import constants from "../constants.js";
import AuditDataSource from "../datasources/Audit/AuditDataSource.js";
import LoginDataSource from "../datasources/Audit/LoginDataSource.js";
import lazyUtils from "../helpers/lazy-data-source-utils.js"

const {FwController} = WebCardinal.controllers;

export default class AuditController extends FwController {
  constructor(...props) {
    super(...props);

    this.model = {};

    this.model.auditLoginDataSource = new LoginDataSource({
      storageService: this.storageService,
      tableName: constants.LOGIN_LOGS_TABLE,
      searchField: "userId",
      dataSourceName: "login",
      onGetDataCallback: () => {
        this.manageSearchContainer(".login-search-container", this.model.auditLoginDataSource);
      }
    });

    this.model.auditActionsDataSource = new AuditDataSource({
      storageService: this.storageService,
      tableName: constants.LOGS_TABLE,
      searchField: "gtin",
      dataSourceName: "actions",
      onGetDataCallback: () => {
        this.manageSearchContainer(".audit-search-container", this.model.auditActionsDataSource);
      }
    });


    lazyUtils.attachHandlers(this, "auditActionsDataSource", "#audit-code-search", "actionsTab-prev-page", "actionsTab-next-page");
    lazyUtils.attachHandlers(this, "auditLoginDataSource", "#user-search", "loginTab-prev-page", "loginTab-next-page");

    this.onTagClick("audit-export", async (model, target, event) => {
      await this.csvExportHandler("actions", this.model.auditActionsDataSource)
    });

    this.onTagClick("login-export", async (model, target, event) => {
      await this.csvExportHandler("login", this.model.auditLoginDataSource)
    });

    this.onTagClick('change-tab', async (model, target, event) => {
      let tabName = target.getAttribute("tab-name");
      if (tabName === "actions") {
        await this.model.auditActionsDataSource.forceUpdate(true);
      }
      if (tabName === "logins") {
        await this.model.auditLoginDataSource.forceUpdate(true);
      }
    })

    this.onTagClick('show-audit-entry', (model, target, event) => {

      let cleanObject = function JSONstringifyOrder(obj) {
        const objToDisplay = {};
        let displayKeys = ["username", "reason", "status", "itemCode", "diffs", "anchorId", "hashLink", "metadata", "logInfo"];
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

    /*  this.updateDataSourceView(5000);*/
  }

  async csvExportHandler(exportType, dataSource) {
    let downloadModal = this.showModalFromTemplate("wait-download", () => {
    }, () => {
    }, {
      disableExpanding: true, disableFooter: true, disableClosing: true, centered: true
    });

    let exportData;
    let allRowData = await $$.promisify(dataSource.storageService.filter, dataSource.storageService)(dataSource.tableName, `__timestamp > 0`, "dsc");

    if (exportType === "actions") {
      exportData = dataSource.getMappedResult(allRowData);
    }

    if (exportType === "login") {
      exportData = allRowData.map((item, index) => {
        delete item["__version"];
        delete item["__timestamp"];
        delete item["pk"];
        return item;
      })
    }

    let csvResult = await this.exportToCSV(exportData);
    let url = window.URL.createObjectURL(csvResult);
    let anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "audit.csv";
    downloadModal.destroy();
    anchor.click();
    window.URL.revokeObjectURL(url);
    anchor.remove();
  }

  async exportToCSV(data) {
    let exportData = data;
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

  manageSearchContainer(selector, datasource) {
    let searchContainer = document.querySelector(selector);
    if (searchContainer) {
      datasource.hasResults ? searchContainer.classList.remove("hiddenElement") : searchContainer.classList.add("hiddenElement")
    }
  }

  /*  updateDataSourceView(interval) {
      setInterval(() => {
        let selectedTabIndex = document.querySelector("dsu-tab-panel").getAttribute("selectedIndex");
        if (selectedTabIndex === "0") {
          this.model.auditActionsDataSource.forceUpdate(true);
        }
        if (selectedTabIndex === "1") {
          this.model.auditLoginDataSource.forceUpdate(true);
        }
      }, interval)

    }*/
}
