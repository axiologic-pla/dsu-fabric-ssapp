import {getCommunicationService} from "../services/CommunicationService.js";
const {WebcController} = WebCardinal.controllers;
import getSharedStorage from "../services/SharedDBStorageService.js";
import constants from "../constants.js";
import utils from "../utils.js";

const {DataSource} = WebCardinal.dataSources;

class BatchesDataSource extends DataSource {
  constructor(...props) {
    const [storageSrv, ...defaultOptions] = props;
    super(...defaultOptions);
    this.itemsOnPage = 15;
    this.storageService = storageSrv;
    this.setPageSize(this.itemsOnPage);
    this.dataSourceRezults = [];
    this.hasMoreLogs = false;
    this.filterResult = [];
  }

  generateSerializationForBatch(batch, serialNumber) {
    if (serialNumber === "" || typeof serialNumber === "undefined") {
      return `(01)${batch.gtin}(10)${batch.batchNumber}(17)${batch.expiry}`;
    }

    return `(01)${batch.gtin}(21)${serialNumber}(10)${batch.batchNumber}(17)${batch.expiry}`;
  }

  generateSerializations(arr) {
    arr.forEach((batch) => {
      batch.code = utils.sanitizeCode(this.generateSerializationForBatch(batch, batch.defaultSerialNumber));
      if (batch.defaultRecalledSerialNumber) {
        batch.recalledCode = utils.sanitizeCode(this.generateSerializationForBatch(batch, batch.defaultRecalledSerialNumber));
      }
      if (batch.defaultDecommissionedSerialNumber) {
        batch.decommissionedCode = utils.sanitizeCode(this.generateSerializationForBatch(batch, batch.defaultDecommissionedSerialNumber));
      }
      let wrongBatch = JSON.parse(JSON.stringify(batch));
      wrongBatch.defaultSerialNumber = "WRONG";
      batch.wrongCode = utils.sanitizeCode(this.generateSerializationForBatch(wrongBatch, wrongBatch.defaultSerialNumber));
      batch.formatedDate = batch.expiry.match(/.{1,2}/g).join("/");
    });
  }

  async getPageDataAsync(startOffset, dataLengthForCurrentPage) {
    if (this.filterResult.length > 0) {
      document.querySelector(".pagination-container").hidden = true;
      this.generateSerializations(this.filterResult);
      return this.filterResult
    }
    let resultData = [];

    try {
      if (this.dataSourceRezults.length > 0) {
        let moreItems = await $$.promisify(this.storageService.filter.bind(this.storageService))(constants.BATCHES_STORAGE_TABLE, `__timestamp < ${this.dataSourceRezults[this.dataSourceRezults.length - 1].__timestamp}`, "dsc", this.itemsOnPage);
        if (moreItems && moreItems.length > 0 && moreItems[moreItems.length - 1].pk !== this.dataSourceRezults[this.dataSourceRezults.length - 1].pk) {
          this.dataSourceRezults = [...this.dataSourceRezults, ...moreItems,];
        }
      } else {
        await $$.promisify(this.storageService.refresh.bind(this.storageService))();
        this.dataSourceRezults = await $$.promisify(this.storageService.filter.bind(this.storageService))(constants.BATCHES_STORAGE_TABLE, "__timestamp > 0", "dsc", this.itemsOnPage * 2);
      }

      this.generateSerializations(this.dataSourceRezults);
      this.dataSourceRezults.length > this.itemsOnPage ? document.querySelector(".pagination-container").hidden = false : document.querySelector(".pagination-container").hidden = true;
      resultData = this.dataSourceRezults.slice(startOffset, startOffset + dataLengthForCurrentPage);
      this.hasMoreLogs = this.dataSourceRezults.length >= startOffset + dataLengthForCurrentPage + 1;

      if (!this.hasMoreLogs) {
        document.querySelector(".pagination-container .next-page-btn").disabled = true;
      } else {
        document.querySelector(".pagination-container .next-page-btn").disabled = false;
      }

    } catch (e) {
      console.log("Eroor on get async page data  ", e);
    }
    return resultData;
  }

}

export default class batchesController extends WebcController {
  constructor(element, history) {
    super(element, history);
    this.model = {};
    this.model.batches = [];
    this.storageService = getSharedStorage(this.DSUStorage);
    getCommunicationService(this.DSUStorage).waitForMessage(() => {});
    this.model.batchesDataSource = new BatchesDataSource(this.storageService);

    let searchInput = this.querySelector("#code-search");
    let foundIcon = this.querySelector(".fa-check");
    let notFoundIcon = this.querySelector(".fa-ban");
    if (searchInput) {
      searchInput.addEventListener("search", async (event) => {
        notFoundIcon.style.display = "none";
        foundIcon.style.display = "none";
        if (event.target.value) {
          await $$.promisify(this.storageService.refresh.bind(this.storageService))();
          let result = await $$.promisify(this.storageService.filter.bind(this.storageService))(constants.BATCHES_STORAGE_TABLE, `gtin == ${event.target.value}`);

          if (result && result.length > 0) {
            foundIcon.style.display = "inline";
            this.model.batchesDataSource.filterResult = result;
            this.goToFirstTablePage();
          } else {
            notFoundIcon.style.display = "inline";
          }
        } else {
          this.model.batchesDataSource.filterResult = [];
          this.goToFirstTablePage();
        }
      })
    }
    this.onTagClick("prev-page", (model, target, event) => {
      target.parentElement.querySelector(".next-page-btn").disabled = false;
      this.model.batchesDataSource.goToPreviousPage();
      if (this.model.batchesDataSource.getCurrentPageIndex() === 1) {
        target.parentElement.querySelector(".prev-page-btn").disabled = true;
      }

    })
    this.onTagClick("next-page", (model, target, event) => {

      target.parentElement.querySelector(".prev-page-btn").disabled = false;
      if (this.model.batchesDataSource.hasMoreLogs) {
        this.model.batchesDataSource.goToNextPage();
      }

    })

    /*await $$.promisify(this.storageService.refresh.bind(this.storageService))();
    const batches = await $$.promisify(this.storageService.filter.bind(this.storageService))(constants.BATCHES_STORAGE_TABLE);*/


    this.onTagClick("view-2DMatrix", (model, target, event) => {
      let eventData = JSON.parse(target.firstElementChild.innerText);
      this.model.actionModalModel = {
        title: "2DMatrix",
        batchData: eventData,
        acceptButtonText: "Close",
      };

      this.showModalFromTemplate("modal2DMatrix", () => {
          return;
        }, () => {
          return;
        },
        {model: this.model}
      );
    });
    this.onTagClick("import-batch", (model, target, event) => {
      event.stopImmediatePropagation();
      this.navigateToPageTag("import");
    });
    this.onTagClick("add-batch", () => {
      this.navigateToPageTag("add-batch");
    });

    this.onTagClick("edit-batch", (model, target, event) => {
        let eventData = target.getAttribute("event-data");
        const batchData = this.model.batchesDataSource.dataSourceRezults.find((element) => element.batchNumber === eventData);
        this.navigateToPageTag("add-batch", {
          batchData: JSON.stringify(batchData),
        });
      },
      {capture: true}
    );
  }


  goToFirstTablePage() {
    document.querySelector(".pagination-container .prev-page-btn").disabled = true;
    this.model.batchesDataSource.goToPageByIndex(0);
  }
}
