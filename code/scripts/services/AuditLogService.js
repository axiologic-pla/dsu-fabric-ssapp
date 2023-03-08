export default class AuditLogService {
  constructor(mappingLogService) {
    this.mappingLogService = mappingLogService;
  }

  async logUndigestedMessages(undigestedMessages) {
    for (let i = 0; i < undigestedMessages.length; i++) {

      let undigestedMessage = undigestedMessages[i];
      let errorStatus = null;
      if(undigestedMessage.error && undigestedMessage.error.debug_message){
        errorStatus = undigestedMessage.error.debug_message
      }
      if (undigestedMessage.error && undigestedMessage.error.otherErrors && undigestedMessage.error.otherErrors.details.length) {
        await this.mappingLogService.logFailAction(undigestedMessage.message, undigestedMessage.error.otherErrors.details, errorStatus)
      } else {
        if(!undigestedMessage.error){
          undigestedMessage.error = "Unknown error. Check Logs!";
        }
        if(!undigestedMessage.message){
          undigestedMessage.message = "Unknown error. Check Logs!";
        }
        await this.mappingLogService.logFailAction(undigestedMessage.message, undigestedMessage.error, errorStatus)
      }
    }
    return;
  }
}
