import MessagesService from "../services/MessagesService.js";

const {WebcController} = WebCardinal.controllers;

class FwController extends WebcController {
    constructor(...props) {
        super(...props);
        try {
            window.WebCardinal.loader.hidden = true;
        } catch (e) {
            // no loader to hide
        }

    const openDSU = require("opendsu");
    this.notificationHandler = openDSU.loadAPI("error");
  }

    getHandlerForMessageDigestingProcess(messages, prepareModalInformation) {
        return (err, undigested) => {

            return new Promise(async (resolve) => {
                if (err) {
                    const modal = prepareModalInformation(err, undigested, messages);
                    this.showErrorModal(
                        new Error(modal.content),
                        modal.title,
                        () => {
                            setTimeout(async () => {
                                await this.logUndigestedMessages(undigested);
                                this.hideModal();

                                resolve();
                            }, 100);
                        },
                        () => {
                            this.hideModal();
                            resolve();
                        },
                        {
                            disableExpanding: true,
                            disableCancelButton: true,
                            confirmButtonText: 'Ok',
                            id: 'first-feedback-modal'
                        });
                    return;
                }

                await this.logUndigestedMessages(undigested);
                this.hideModal();
                resolve();
                return;

            });
        }
    }

    prepareModalInformation(err, undigested, initialMessages) {
        console.log("This method needs to be impl by each controller");
        return {
            title: "No title",
            content: "No content"
        }
    }

    async logUndigestedMessages(undigested) {
        try {
            await $$.promisify(MessagesService.logFailedMessages)(undigested, this.storageService);
        } catch (err) {
            window.WebCardinal.loader.hidden = true;
            this.showErrorModal(
                new Error(`Unable to save failed messages. Cause: ${err.message ? err.message : ''}`),
                'Log operation status',
                () => {
                },
                () => {
                },
                {
                    disableExpanding: true,
                    disableCancelButton: true,
                    confirmButtonText: 'Ok',
                    id: 'failed-to-log-modal'
                });
        }
    }
}

export {FwController};
