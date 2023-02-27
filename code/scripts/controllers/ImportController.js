import MessagesService from "../services/MessagesService.js";
import FailedLogDataSource from "../datasources/Import/FailedLogDataSource.js";
import SuccessLogDataSource from "../datasources/Import/SuccessLogDataSource.js";

const {FwController} = WebCardinal.controllers;

export default class importController extends FwController {

    constructor(...props) {

        super(...props);
        this.filesArray = [];
        const dbAPI = require("opendsu").loadAPI("db");

        this.model = {
            selectedTab: 0,
            filesChooser: {
                label: "Select files",
                accept: ".json",
                listFiles: false,
                filesAppend: true,
                "event-name": "uploadProducts",
                "list-files": false
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
            if (this.filesArray.length !== 0) {
              this.model.filesChooser.listFiles = true;
              this.model.filesChooser["list-files"] = true;
            }
        });

        this.onTagClick("import", async () => {
            if (this.filesArray.length === 0) {
                return;
            }
            let messages;
            try {
                messages = await this.getMessagesFromFiles(this.filesArray);
                window.WebCardinal.loader.hidden = false;
            } catch (err) {
                this.showErrorModal(`Unable to read selected files.`, "Error");
            }
            MessagesService.digestMessagesOneByOne(JSON.parse(JSON.stringify(messages)), this.storageService, async (err, undigested) => {
                window.WebCardinal.loader.hidden = true;
                await this.manageProcessedMessages(undigested);
                if (err) {
                    this.showErrorModal(
                        new Error(`There was an error during import process. Failed to import ${undigested.length} from a total of ${messages.length} messages. Cause: ${err.message ? err.message : ''}`),
                        'Import failed',
                        () => {
                            setTimeout(()=>{
                                this.createWebcModal({
                                    disableExpanding: true,
                                    disableClosing: true,
                                    disableFooter: true,
                                    modalTitle: "Info",
                                    modalContent: "Saving failed messages..."
                                });

                                MessagesService.logFailedMessages(undigested, this.storageService, (err) => {
                                    if (err) {
                                        this.hideModal();
                                        this.showErrorModal(
                                            new Error(`Unable to save failed messages. Cause: ${err.message ? err.message : ''}`),
                                            'Log operation status',
                                            () => {},
                                            () => {},
                                            {
                                                disableExpanding: true,
                                                disableCancelButton: true,
                                                confirmButtonText: 'Ok',
                                                id: 'import-failed-modal'
                                            });
                                    }
                                });
                            }, 100);
                        },
                        () => {},
                        {
                            disableExpanding: true,
                            disableCancelButton: true,
                            confirmButtonText: 'Ok',
                            id: 'import-feedback-modal'
                        });
                    return
                }

                this.model.failedImportedLogs = [];
                this.model.retryAll = false;

              this.filesArray = [];
              this.model.importIsDisabled = this.filesArray.length === 0;
              this.model.filesChooser.listFiles = false;
              this.model.filesChooser["list-files"] = false;

            });

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
                } else {
                    this.model.successDataSource.filterResult = [];
                    this.model.failedDataSource.filterResult = [];
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

        function getSelectedFailed(prepareFnc) {
            let messages = [];
            this.model.failedImportedLogs.forEach(elem => {
                if (elem.retry) {
                    let msg = elem.message;
                    if (prepareFnc) {
                        msg = prepareFnc(msg);
                    }
                    messages.push(msg);
                }
            });
            return messages;
        }

        function prepareCallback(prepareFnc) {
            return async (model, target, event) => {
                let messages = getSelectedFailed.call(this, prepareFnc);
                if (messages.length > 0) {
                    this.model.selectedTab = 1;
                    window.WebCardinal.loader.hidden = false;

                    await MessagesService.processMessages(messages, this.storageService, async (undigestedMessages) => {
                        await this.manageProcessedMessages(undigestedMessages);
                        this.model.failedImportedLogs = [];
                    });

                    this.model.retryAll = false;

                    this.querySelector("#retry-all-checkbox").checked = false;
                }
            }
        }

        let self = this;
        this.onTagClick("retry-failed", prepareCallback.call(self));

        this.onTagClick("force-retry-failed", prepareCallback.call(self, (msg) => {
            msg.force = true;
            return msg;
        }));

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

    async manageProcessedMessages(undigestedMessages) {
        window.WebCardinal.loader.hidden = true;
        this.querySelector(".prev-page-btn[msgType='success']").disabled = true;
        this.querySelector(".next-page-btn[msgType='success']").disabled = false;
        this.model.successDataSource.importLogs = [];
        await this.model.successDataSource.goToPageByIndex(0);
        this.querySelector(".prev-page-btn[msgType='failed']").disabled = true;
        this.querySelector(".next-page-btn[msgType='failed']").disabled = false;
        this.model.failedDataSource.importLogs = [];
        await this.model.failedDataSource.goToPageByIndex(0);

        if (undigestedMessages.length === 0) {
            this.model.selectedTab = 0;
        } else {
            this.model.selectedTab = 1;
        }
    }

}
