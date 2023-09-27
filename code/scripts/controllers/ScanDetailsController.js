import constants from "../constants.js";

const {FwController} = WebCardinal.controllers;

export default class ScanDetailsController extends FwController {
  constructor(...props) {
    super(...props);
    const state = this.history.location.state;

    this.storageService.getRecord(constants.BLOCKCHAIN_SCANS_TABLE, state.scanId, (err, record) => {
      if (err) {
        return this.notificationHandler.reportUserRelevantError("Something went wrong! Couldn't retrieve scan data!")
      }
      this.model.scanResults = [];
      let failedArr = [...record.missingDataScans, ...record.missingKeyScans]
      failedArr.forEach(missingData => {
        let displayItem = {gtin: "-", batch: "-"};
        if (missingData.gtin) {
          displayItem.gtin = missingData.gtin;
        }
        if (missingData.batch) {
          displayItem.batch = missingData.batch;
        }
        this.model.scanResults.push(displayItem);
      })
    });

  }
}
