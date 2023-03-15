const {FwController} = WebCardinal.controllers;
import BatchesDataSource from "../datasources/BatchesDataSource.js"
import constants from "../constants.js";
import lazyUtils from "../helpers/lazy-data-source-utils.js";

export default class batchesController extends FwController {
  constructor(element, history) {
    super(element, history);
    this.model = {userrights: this.userRights, batches: []};

    this.model.batchesDataSource = new BatchesDataSource({
      storageService: this.storageService,
      tableName: constants.BATCHES_STORAGE_TABLE,
      searchField: "gtin",
      dataSourceName: "batches"
    });

    lazyUtils.attachHandlers(this, "batchesDataSource");
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

    this.onTagClick("edit-batch", async (model, target, event) => {
        let eventData = JSON.parse(target.firstElementChild.innerText);
        const batchData = this.model.batchesDataSource.dataSourceRezults.find((element) => element.batchNumber === eventData.batchNumber && element.gtin === eventData.gtin) ;
        this.navigateToPageTag("add-batch", {
          batchData: JSON.stringify(batchData)
        });
      },
      {capture: true}
    );

  }
}
