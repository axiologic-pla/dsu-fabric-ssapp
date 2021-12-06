import utils from "../utils.js";
import getSharedStorage from "../services/SharedDBStorageService.js";
import MessagesService from "../services/MessagesService.js";


const {WebcController} = WebCardinal.controllers;
const {DataSource} = WebCardinal.dataSources;

class SuccessLogDataSource extends DataSource {
  constructor(...props) {
    const [enclvDB, ...defaultOptions] = props;
    super(...defaultOptions);
    this.itemsOnPage = 2;
    this.setPageSize(this.itemsOnPage);
    this.enclaveDB = enclvDB;
    this.importLogs = [];
  }

  async getPageDataAsync(startOffset, dataLengthForCurrentPage) {
    window.WebCardinal.loader.hidden = false;
    let importLogs = [];
    try {
      if (this.importLogs.length > 0) {
        let moreItems = await $$.promisify(this.enclaveDB.filter)('import-logs', [`__timestamp < ${this.importLogs[this.importLogs.length - 1].__timestamp}`, 'status == success'], "dsc", this.itemsOnPage);
        if (moreItems && moreItems.length > 0 && moreItems[moreItems.length - 1].pk !== this.importLogs[this.importLogs.length - 1].pk) {
          this.importLogs = [...this.importLogs, ...moreItems];
        }
      } else {
        this.importLogs = await $$.promisify(this.enclaveDB.filter)('import-logs', ['__timestamp > 0', 'status == success'], "dsc", this.itemsOnPage * 2);
      }

      importLogs = this.importLogs.slice(startOffset, startOffset + dataLengthForCurrentPage);
      let now = Date.now();
      importLogs = importLogs.map(log => {
        if (log.message) {
          log.timeAgo = utils.timeAgo(log.timestamp)
          log.isFresh = now - log.timestamp < 60 * 1000;
          return log;
        }
      })
      window.WebCardinal.loader.hidden = true;
    } catch (e) {
      console.log(e);
    }
    return importLogs
  }
}

class FailedLogDataSource extends DataSource {
  constructor(...props) {
    const [enclvDB, ...defaultOptions] = props;
    super(...defaultOptions);
    this.itemsOnPage = 2;
    this.setPageSize(this.itemsOnPage);
    this.enclaveDB = enclvDB;
    this.importLogs = [];
  }

  async getPageDataAsync(startOffset, dataLengthForCurrentPage) {
    window.WebCardinal.loader.hidden = false;
    let importLogs = [];
    try {
      if (this.importLogs.length > 0) {
        let moreItems = await $$.promisify(this.enclaveDB.filter)('import-logs', [`_timestamp < ${this.importLogs[this.importLogs.length - 1].__timestamp}`, 'status != success'], "dsc", this.itemsOnPage);
        if (moreItems && moreItems.length > 0 && moreItems[moreItems.length - 1].pk !== this.importLogs[this.importLogs.length - 1].pk) {
          this.importLogs = [...this.importLogs, ...moreItems];
        }
      } else {
        this.importLogs = await $$.promisify(this.enclaveDB.filter)('import-logs', ['__timestamp > 0', 'status != success'], "dsc", this.itemsOnPage * 2);
      }
      importLogs = this.importLogs.slice(startOffset, startOffset + dataLengthForCurrentPage);
      let now = Date.now();
      importLogs = importLogs.map(log => {
        if (log.message) {
          log.timeAgo = utils.timeAgo(log.timestamp)
          log.isFresh = now - log.timestamp < 60 * 1000;
          log.retry = false;
          log.itemId = log.itemCode + '_' + log.timestamp
          return log;
        }
      })

      window.WebCardinal.loader.hidden = true;
    } catch (e) {
      console.log(e);
    }
    return importLogs
  }
}

export default class importController extends WebcController {

  constructor(...props) {

    super(...props);
    this.filesArray = [];
    const storageService = getSharedStorage(this.DSUStorage);
    const dbAPI = require("opendsu").loadAPI("db");
    dbAPI.getSharedEnclaveDB((err, enclaveDB) => {
      if (err) {
        return console.log(err);
      }

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
        successDataSource: new SuccessLogDataSource(enclaveDB),
        failedDataSource: new FailedLogDataSource(enclaveDB),
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
        if (!this.DSUStorage.directAccessEnabled) {
          this.DSUStorage.enableDirectAccess(async () => {
            await MessagesService.processMessages(messages, this.DSUStorage, this.manageProcessedMessages.bind(this));
          })
        } else {
          await MessagesService.processMessages(messages, this.DSUStorage, this.manageProcessedMessages.bind(this));
        }

      });

      this.onTagClick("view-all", async () => {
        window.open(`${window.location.origin}/mappingEngine/${this.domain}/logs`, '_blank');
      })

      this.onTagClick("prev-page", () => this.model.datasource.goToPreviousPage());

      this.onTagClick("next-page", () => this.model.datasource.goToNextPage());
      this.onTagClick("search-by-code", (model, target, event) => {
        console.log("----------->>>> ", model, target, event)
      })

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

      this.model.onChange("retryAll", (event) => {
        this.querySelectorAll(".failed-message").forEach((elem) => {
          elem.checked = this.model.retryAll
        });

        this.model.failedImportedLogs.forEach(elem => {
          elem.retry = this.model.retryAll;
        });
      });

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
          if (!this.DSUStorage.directAccessEnabled) {
            this.DSUStorage.enableDirectAccess(async () => {
              await MessagesService.processMessages(messages, this.DSUStorage, this.manageProcessedMessages.bind(this));
            })
          } else {
            await MessagesService.processMessages(messages, this.DSUStorage, this.manageProcessedMessages.bind(this));
          }
          this.model.retryAll = false;
          this.querySelector("#retry-all-checkbox").checked = false;
        }
      })

      this.model.onChange("failedImportedLogs", () => {
        this.model.retryBtnIsDisabled = !this.model.failedImportedLogs.some(failedLog => failedLog.retry === true)
      })
    })

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

    /*    if (undigestedMessages.length === 0) {
      this.model.setChainValue("selectedTab", 0);
    } else {
      this.model.setChainValue("selectedTab", 1)
        }*/
  }

}


