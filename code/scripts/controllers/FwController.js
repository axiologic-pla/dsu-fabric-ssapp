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
    }

    getHandlerForMessageDigestingProcess(messages, prepareModalInformation){
      return (err, undigested) => {

        return new Promise(async (resolve)=>{
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

          if(undigested.length){
            await this.logUndigestedMessages(undigested);
            this.hideModal();
          }
          resolve();
        });
      }
    }

    prepareModalInformation(err, undigested, initialMessages){
      console.log("This method needs to be impl by each controller");
      return {
        title:"No title",
        content:"No content"
      }
    }

  async logUndigestedMessages(undigested){
    this.createWebcModal({
      disableExpanding: true,
      disableClosing: true,
      disableFooter: true,
      modalTitle: "Info",
      modalContent: "Saving failed messages..."
    });

    try{
        await $$.promisify(MessagesService.logFailedMessages)(undigested, this.storageService);
    }catch(err){
        this.hideModal();
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

    this.hideModal();
  }
}

export {FwController};
