import utils from "../utils.js";
import MessagesService from "../services/MessagesService.js";

const {FwController} = WebCardinal.controllers;
const {DataSource} = WebCardinal.dataSources;

class SuccessLogDataSource extends DataSource {
  constructor(...props) {
    const [enclvDB, ...defaultOptions] = props;
    super(...defaultOptions);
    this.itemsOnPage = 15;
    this.setPageSize(this.itemsOnPage);
    this.enclaveDB = enclvDB;
    this.importLogs = [];
    this.hasMoreLogs = false;
    this.filterResult = [];
  }

  async getPageDataAsync(startOffset, dataLengthForCurrentPage) {
    window.WebCardinal.loader.hidden = false;

    if (this.filterResult.length > 0) {
      window.WebCardinal.loader.hidden = true;
      document.querySelector(".success-messages-page-btn").hidden = true;
      return this.filterResult
    }

    let importLogs = [];
    try {
      if (this.importLogs.length > 0) {
        let moreItems = await $$.promisify(this.enclaveDB.filter)('import-logs', [`__timestamp < ${this.importLogs[this.importLogs.length - 1].__timestamp}`, 'status == success'], "dsc", this.itemsOnPage);
        if (moreItems && moreItems.length > 0 && moreItems[moreItems.length - 1].pk !== this.importLogs[this.importLogs.length - 1].pk) {
          this.importLogs = [...this.importLogs, ...moreItems,];
        }
      } else {
        this.importLogs = await $$.promisify(this.enclaveDB.filter)('import-logs', ['__timestamp > 0', 'status == success'], "dsc", this.itemsOnPage * 2);
      }
      this.importLogs.length > this.itemsOnPage ? document.querySelector(".success-messages-page-btn").hidden = false : document.querySelector(".success-messages-page-btn").hidden = true;

      importLogs = this.importLogs.slice(startOffset, startOffset + dataLengthForCurrentPage);
      this.hasMoreLogs = this.importLogs.length >= startOffset + dataLengthForCurrentPage + 1;

      if (!this.hasMoreLogs) {
        document.querySelector(".success-messages-page-btn .next-page-btn").disabled = true;
      } else {
        document.querySelector(".success-messages-page-btn .next-page-btn").disabled = false;
      }

      let now = Date.now();
      importLogs = importLogs.map(log => {
        if (log.message) {
          log.timeAgo = utils.timeAgo(log.timestamp)
          log.isFresh = now - log.timestamp < 60 * 1000;
          log.itemMsgId = log.message.messageId;
          return log;
        }
      })
      window.WebCardinal.loader.hidden = true;
    } catch (e) {
      console.log(e);
    }
    if (!importLogs.length > 0) {
      document.querySelector(".success-messages-page-btn").style.display = "none";
    } else {
      document.querySelector(".success-messages-page-btn").style.display = "flex";
    }
    return importLogs
  }
}

class FailedLogDataSource extends DataSource {
  constructor(...props) {
    const [enclvDB, ...defaultOptions] = props;
    super(...defaultOptions);
    this.itemsOnPage = 15;
    this.setPageSize(this.itemsOnPage);
    this.enclaveDB = enclvDB;
    this.importLogs = [];
    this.hasMoreLogs = false;
    this.filterResult = [];
  }

  async getPageDataAsync(startOffset, dataLengthForCurrentPage) {
    window.WebCardinal.loader.hidden = false;

    if (this.filterResult.length > 0) {
      window.WebCardinal.loader.hidden = true;
      document.querySelector(".failed-messages-page-btn").hidden = true;
      return this.filterResult
    }

    let importLogs = [];
    try {
      if (this.importLogs.length > 0) {
        let moreItems = await $$.promisify(this.enclaveDB.filter)('import-logs', [`__timestamp < ${this.importLogs[this.importLogs.length - 1].__timestamp}`, 'status != success'], "dsc", this.itemsOnPage);
        if (moreItems && moreItems.length > 0 && moreItems[moreItems.length - 1].pk !== this.importLogs[this.importLogs.length - 1].pk) {
          this.importLogs = [...this.importLogs, ...moreItems];
        }
      } else {
        this.importLogs = await $$.promisify(this.enclaveDB.filter)('import-logs', ['__timestamp > 0', 'status != success'], "dsc", this.itemsOnPage * 2);
      }
      this.importLogs.length > this.itemsOnPage ? document.querySelector(".failed-messages-page-btn").hidden = false : document.querySelector(".failed-messages-page-btn").hidden = true;

      importLogs = this.importLogs.slice(startOffset, startOffset + dataLengthForCurrentPage);
      this.hasMoreLogs = this.importLogs.length >= startOffset + dataLengthForCurrentPage + 1;

      let now = Date.now();
      importLogs = importLogs.map(log => {
        if (log.message) {
          log.timeAgo = utils.timeAgo(log.timestamp)
          log.isFresh = now - log.timestamp < 60 * 1000;
          log.retry = false;
          log.itemId = log.itemCode + '_' + log.timestamp;
          log.itemMsgId = log.message.messageId;
          return log;
        }
      })

      window.WebCardinal.loader.hidden = true;
    } catch (e) {
      console.log(e);
    }
    if (!importLogs.length > 0) {
      document.querySelector(".failed-messages-page-btn").style.display = "none";
    } else {
      document.querySelector(".failed-messages-page-btn").style.display = "flex";
    }
    return importLogs
  }
}

export default class importController extends FwController {

  constructor(...props) {

    super(...props);
    this.filesArray = [];
    const dbAPI = require("opendsu").loadAPI("db");

    this.model = {
      selectedTab: 0,
      filesChooser: {
        label: "Select files",
        accept: "json",
        listFiles: true,
        filesAppend: true,
        "event-name": "uploadProducts",
        "list-files": true
      },
      importIsDisabled: true,
      retryBtnIsDisabled: true,
      successfullyImportedLogs: [],
      failedImportedLogs: [],
      retryAll: false,
      successDataSource: new SuccessLogDataSource(this.storageService),
      failedDataSource: new FailedLogDataSource(this.storageService),
    };

    this.on('uploadProducts', (event) => {
      this.filesArray = event.data || [];
      this.model.importIsDisabled = this.filesArray.length === 0;
    });

    this.onTagClick("import", async () => {
      if (this.filesArray.length === 0) {
        return;
      }
      let messages
      try {
        messages = await this.getMessagesFromFiles(this.filesArray);
      } catch (err) {
        this.showErrorModal(`Could not import file. ${err.message}`, "Error");
        return;
      }

      window.WebCardinal.loader.hidden = false;
      await MessagesService.processMessages(messages, this.storageService, this.manageProcessedMessages.bind(this));
    });
/*
    Removed for MVP1

    this.onTagClick("view-all", async () => {
      const openDSU = require("opendsu");
      const config = openDSU.loadAPI("config");
      const domain = await $$.promisify(config.getEnv)("epiDomain");
      window.open(`${window.location.origin}/mappingEngine/${domain}/logs`, '_blank');
    })
*/


    this.onTagClick("prev-page", async (model, target, event) => {
      let dataSource;
      if (target.getAttribute("msgType") === "success") {
        dataSource = this.model.successDataSource;
      } else {
        dataSource = this.model.failedDataSource;
      }
      target.parentElement.querySelector(".next-page-btn").disabled = false;
      await dataSource.goToPreviousPage();
      if (dataSource.getCurrentPageIndex() === 0) {
        target.disabled = true;
      }
    })

    this.onTagClick("next-page", async (model, target, event) => {
      let dataSource;
      if (target.getAttribute("msgType") === "success") {
        dataSource = this.model.successDataSource;
      } else {
        dataSource = this.model.failedDataSource;
      }
      target.parentElement.querySelector(".prev-page-btn").disabled = false;
      if (dataSource.hasMoreLogs) {
        await dataSource.goToNextPage();
        if (!dataSource.hasMoreLogs) {
          target.parentElement.querySelector(".next-page-btn").disabled = true;
        }
      }
    })

    let searchInput = this.querySelector("#code-search");
    let foundIcon = this.querySelector(".fa-check");
    let notFoundIcon = this.querySelector(".fa-ban");
    if (searchInput) {
      searchInput.addEventListener("search", async (event) => {
        notFoundIcon.style.display = "none";
        foundIcon.style.display = "none";
        if (event.target.value) {
          let results = await $$.promisify(this.storageService.filter)('import-logs', `itemCode == ${event.target.value}`);
          if (results && results.length > 0) {
            foundIcon.style.display = "inline";
            this.model.successDataSource.filterResult = results.filter(item => item.status === "success");
            this.model.failedDataSource.filterResult = results.filter(item => item.status !== "success");
            if (results[0].status === "success") {
              this.model.selectedTab = 0;
            } else {
              this.model.selectedTab = 1;
            }
          } else {
            notFoundIcon.style.display = "inline";
          }
        }
        this.model.successDataSource.goToPageByIndex(0);
        this.model.failedDataSource.goToPageByIndex(0);
      })
    }

    this.onTagClick("view-message", (model, target, event) => {
      let secondMessage;
      this.model.actionModalModel = {
        title: "Message",
        denyButtonText: 'Close',
        acceptButtonText: "Download message"
      }
      if (model.message.invalidFields) {
        secondMessage = model.message.invalidFields;
        delete model.message.invalidFields
        this.model.actionModalModel.secondMessageData = secondMessage;
        this.model.actionModalModel.showSecondMessage = true;
      }

      const formattedJSON = JSON.stringify(model.message, null, 4);

      this.model.actionModalModel.messageData = formattedJSON;


      this.showModalFromTemplate('view-message-modal',
        () => {
          let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(formattedJSON);
          let downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href", dataStr);
          downloadAnchorNode.setAttribute("download", model.itemType + "_" + model.itemCode + ".json");
          document.body.appendChild(downloadAnchorNode); // required for firefox
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
        }, () => {
          return
        }, {model: this.model});
    })

    this.onTagEvent("retry-all-click", "change", (model, target, evt) => {
      this.querySelectorAll(".failed-message").forEach((elem) => {
        elem.checked = target.checked;
        elem.value = target.checked;
      });

      if (target.checked) {
        this.model.failedImportedLogs = model.data.map(item => {
          item.retry = true;
          return item
        });
      } else {
        this.model.failedImportedLogs = [];
      }

      this.updateRetryBtnState();

    })

    this.onTagEvent("retry-item-click", "change", (model, target, evt) => {
      model.retry = target.checked;
      if (!target.checked) {
        this.model.failedImportedLogs.splice(this.model.failedImportedLogs.indexOf(model), 1);
        document.querySelector("#retry-all-checkbox").checked = target.checked;
      } else {
        this.model.failedImportedLogs.push(model);
      }

      this.updateRetryBtnState();
    })

    this.onTagClick("retry-failed", async (model, target, event) => {
      let messages = [];
      this.model.failedImportedLogs.forEach(elem => {
        if (elem.retry) {
          messages.push(elem.message);
        }
      });
      if (messages.length > 0) {
        this.model.selectedTab = 1;
        window.WebCardinal.loader.hidden = false;

        await MessagesService.processMessages(messages, this.storageService, this.manageProcessedMessages.bind(this));

        this.model.retryAll = false;
        this.querySelector("#retry-all-checkbox").checked = false;
      }
    })

  }

  updateRetryBtnState() {
    let hasCheckedItems = Array.from(this.querySelectorAll(".failed-message")).findIndex((elem) => elem.checked) >= 0;
    let hasUnCheckedItems = Array.from(this.querySelectorAll(".failed-message")).findIndex((elem) => !elem.checked) >= 0;
    if (hasUnCheckedItems) {
      this.querySelector("#retry-all-checkbox").checked = false;
    } else {
      this.querySelector("#retry-all-checkbox").checked = true;
    }
    this.model.retryBtnIsDisabled = !hasCheckedItems;
  }

  async getMessagesFromFiles(files) {
    let messages = [];
    let filesRead = 0;

    return new Promise((resolve, reject) => {
      for (let i = 0; i < files.length; i++) {
        let file = files[i];

        let fileReader = new FileReader();
        fileReader.readAsText(file, "UTF-8");

        fileReader.onload = function (evt) {
          let message;
          try {
            message = JSON.parse(evt.target.result);
          } catch (e) {
            reject(e);
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
          if (filesRead === files.length) {
            resolve(messages);
          }
        }

        fileReader.onerror = function (evt) {
          throw new Error("Error reading file")
        }
      }
    })
  }

  manageProcessedMessages(undigestedMessages) {
    window.WebCardinal.loader.hidden = true;
    if (undigestedMessages.length === 0) {
      this.model.selectedTab = 0;
    } else {
      this.model.selectedTab = 1;
    }
    this.querySelector(".prev-page-btn[msgType='success']").disabled = true;
    this.querySelector(".next-page-btn[msgType='success']").disabled = false;
    this.model.successDataSource.importLogs = [];
    this.model.successDataSource.goToPageByIndex(0);
    this.querySelector(".prev-page-btn[msgType='failed']").disabled = true;
    this.querySelector(".next-page-btn[msgType='failed']").disabled = false;
    this.model.failedDataSource.importLogs = [];
    this.model.failedDataSource.goToPageByIndex(0);
  }

}


