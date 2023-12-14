import constants from "../constants.js";
import lazyUtils from "../helpers/lazy-data-source-utils.js";
import ScansDataSource from "../datasources/ScansDataSource.js";

const {FwController} = WebCardinal.controllers;

export default class BlockchainStatusController extends FwController {
  constructor(...props) {
    super(...props);
    const openDSU = require("opendsu");
    const anchoring = openDSU.loadAPI("anchoring");
    const anchoringx = anchoring.getAnchoringX();
    const config = openDSU.loadAPI("config");
    config.getEnv("epiDomain", (err, domain) => {
      if (err) {
        return this.notificationHandler.reportUserRelevantError("Couldn't read epiDomain");
      }
      anchoringx.totalNumberOfAnchors(domain, (err, numberOfAnchors) => {
        this.model.totalNumberOfAnchors = numberOfAnchors;
      })
    })
    this.model.scansDataSource = new ScansDataSource({
      storageService: this.storageService,
      tableName: constants.BLOCKCHAIN_SCANS_TABLE,
      dataSourceName: "scans"
    });

    lazyUtils.attachHandlers(this, "scansDataSource");

    this.onTagClick("new-scan", async () => {
      await this.getMockScans();
      await this.model.scansDataSource.forceUpdate(true);
      await this.model.scansDataSource.goToPageByIndex(0);
    })
    this.onTagClick("scan-details", (model) => {
      this.navigateToPageTag("scan-details", {scanId: model.pk});
    })
  }

  generateRandomDate(from, to) {
    return new Date(
      from.getTime() +
      Math.random() * (to.getTime() - from.getTime()),
    );
  }

  randomIntFromInterval(min, max) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min)
  }

  getRandomGtin() {
    let gtin = "";
    for (let i = 0; i < 14; i++) {
      gtin = gtin + this.randomIntFromInterval(0, 9);
    }
    return gtin;
  }

  getRandomAnchor() {
    let anchor = "";
    for (let i = 0; i < 20; i++) {
      anchor = anchor + this.randomIntFromInterval(0, 9);
    }
    return anchor;
  }

  getRandomBatch() {
    let batchId = "BT";
    for (let i = 0; i < 5; i++) {
      batchId = batchId + this.randomIntFromInterval(0, 9);
    }
    return batchId;
  }

  async getMockScans() {
    await $$.promisify(this.storageService.safeBeginBatch, this.storageService.safeBeginBatch)(true);
    for (let i = 0; i < 5; i++) {
      let numberOfLeaflets = this.randomIntFromInterval(1, 20);
      let successData = this.randomIntFromInterval(1, 20);
      let failData = [];
      let failKeys = [];
      for (let j = 0; j < this.randomIntFromInterval(1, 6); j++) {
        failData.push({gtin: this.getRandomGtin()})
      }
      for (let j = 0; j < this.randomIntFromInterval(1, 10); j++) {
        failData.push({batch: this.getRandomBatch()})
      }
      for (let j = 0; j < this.randomIntFromInterval(1, 10); j++) {
        failKeys.push({anchorId: this.getRandomAnchor()})
      }

      let data = {
        leafletsCount: numberOfLeaflets,
        successfulScans: successData,
        missingDataScans: failData,
        missingKeyScans: failKeys,

      }
      await $$.promisify(this.storageService.insertRecord, this.storageService)(constants.BLOCKCHAIN_SCANS_TABLE, this.randomIntFromInterval(1, 100000000), data);
    }
    await this.storageService.commitBatchAsync();
  }

}
