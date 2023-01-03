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
      let downloadModal = this.showModalFromTemplate("wait-download", () => {
      }, () => {
      }, {
        disableExpanding: true, disableFooter: true, disableClosing: true, centered: true
      });
      let csvResult = await this.model.auditActionsDataSource.exportToCSV();
      let url = window.URL.createObjectURL(csvResult);
      let anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "audit.csv";
      downloadModal.destroy();
      anchor.click();
      window.URL.revokeObjectURL(url);
      anchor.remove();
    })

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
