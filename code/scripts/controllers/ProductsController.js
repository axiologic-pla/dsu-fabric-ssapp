const {WebcController} = WebCardinal.controllers;
import constants from "../constants.js";
import getSharedStorage from "../services/SharedDBStorageService.js";
import LogService from "../services/LogService.js";
import Product from "../models/Product.js";
import { getCommunicationService } from "../services/CommunicationService.js";

const {DataSource} = WebCardinal.dataSources;

class ProductsDataSource extends DataSource {
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

  async getPageDataAsync(startOffset, dataLengthForCurrentPage) {
    if (this.filterResult.length > 0) {
      document.querySelector(".pagination-container").hidden = true;
      return this.filterResult
    }
    let resultData = [];

    try {
      if (this.dataSourceRezults.length > 0) {
        let moreItems = await $$.promisify(this.storageService.filter.bind(this.storageService))(constants.PRODUCTS_TABLE, `__timestamp < ${this.dataSourceRezults[this.dataSourceRezults.length - 1].__timestamp}`, "dsc", this.itemsOnPage);
        if (moreItems && moreItems.length > 0 && moreItems[moreItems.length - 1].pk !== this.dataSourceRezults[this.dataSourceRezults.length - 1].pk) {
          this.dataSourceRezults = [...this.dataSourceRezults, ...moreItems,];
        }
      } else {
        await $$.promisify(this.storageService.refresh.bind(this.storageService))();
        this.dataSourceRezults = await $$.promisify(this.storageService.filter.bind(this.storageService))(constants.PRODUCTS_TABLE, "__timestamp > 0", "dsc", this.itemsOnPage * 2);
      }
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

export default class ProductsController extends WebcController {
  constructor(element, history) {
    super(element, history);

    this.model = {};
    this.storageService = getSharedStorage(this.DSUStorage);
    this.logService = new LogService(this.DSUStorage);
    this.model.prodDataSource = new ProductsDataSource(this.storageService);
    getCommunicationService(this.DSUStorage).waitForMessage(() => {});

    let searchInput = this.querySelector("#code-search");
    let foundIcon = this.querySelector(".fa-check");
    let notFoundIcon = this.querySelector(".fa-ban");
    if (searchInput) {
      searchInput.addEventListener("search", async (event) => {
        notFoundIcon.style.display = "none";
        foundIcon.style.display = "none";
        if (event.target.value) {
          await $$.promisify(this.storageService.refresh.bind(this.storageService))();
          let result = await $$.promisify(this.storageService.filter.bind(this.storageService))(constants.PRODUCTS_TABLE, `gtin == ${event.target.value}`);

          if (result && result.length > 0) {
            foundIcon.style.display = "inline";
            this.model.prodDataSource.filterResult = result;
            this.goToFirstTablePage();
          } else {
            notFoundIcon.style.display = "inline";
          }
        } else {
          this.model.prodDataSource.filterResult = [];
          this.goToFirstTablePage();
        }
      })
    }


    this.onTagClick("prev-page", (model, target, event) => {
      target.parentElement.querySelector(".next-page-btn").disabled = false;
      this.model.prodDataSource.goToPreviousPage();
      if (this.model.prodDataSource.getCurrentPageIndex() === 1) {
        target.parentElement.querySelector(".prev-page-btn").disabled = true;
      }

    })
    this.onTagClick("next-page", (model, target, event) => {

      target.parentElement.querySelector(".prev-page-btn").disabled = false;
      if (this.model.prodDataSource.hasMoreLogs) {
        this.model.prodDataSource.goToNextPage();
      }

    })

    this.onTagClick("add-product", (model, target, event) => {
      event.stopImmediatePropagation();
      this.navigateToPageTag("manage-product");
    });

    this.onTagClick("import", (model, target, event) => {
      event.stopImmediatePropagation();
      this.navigateToPageTag("import");
    });

    this.onTagClick("transfer", (model, target, event) => {
      const gtin = target.getAttribute("gtin");
      this.storageService.getRecord(constants.PRODUCTS_TABLE, gtin, (err, product) => {
          this.model.actionModalModel = {
            title: "Enter the company name to which the product is transferred",
            transferCode: $$.Buffer.from(JSON.stringify(product)).toString("base64"),
            acceptButtonText: "Accept",
            mah: "",
            denyButtonText: "Cancel",
          };

          this.showModalFromTemplate("transfer-product-modal", (event) => {
              product.transferred = true;
              product.manufName = this.model.actionModalModel.mah;
              this.logService.log({
                  logInfo: product,
                  username: this.model.username,
                  action: `Transferred product to ${this.model.actionModalModel.mah}`,
                  logType: "PRODUCT_LOG",
                }, () => {
                }
              );
            }, (event) => {
              return;
            },
            {model: this.model}
          );
        }
      );
    });

    this.onTagClick("get-transferred-product", (event) => {
      this.model.actionModalModel = {
        title: "Add transferred product",
        acceptButtonText: "Accept",
        denyButtonText: "Cancel",
        transferCode: "",
      };
      this.showModalFromTemplate("get-transferred-product-modal", (response) => {
          if (this.model.actionModalModel.transferCode === undefined) {
            return;
          }
          const product = JSON.parse($$.Buffer.from(this.model.actionModalModel.transferCode, "base64").toString());
          this.addProductToProductsList(new Product(product), (err) => {
            if (err) {
              return console.log(err);
            }
          });
        }, (err) => {
          return;
        },
        {model: this.model}
      );
    });

    this.onTagClick("edit-product", (model, target, event) => {
        const gtin = event.target.getAttribute("gtin");
        this.navigateToPageTag("manage-product", {gtin: gtin});
      },
      {capture: true}
    );

    this.on("view-drug", (event) => {
      this.navigateToPageTag("drug-details");
    });

    this.on("openFeedback", (e) => {
      this.feedbackEmitter = e.detail;
    });
  }


  goToFirstTablePage() {
    document.querySelector(".pagination-container .prev-page-btn").disabled = true;
    this.model.prodDataSource.goToPageByIndex(0);
  }

  addProductToProductsList(product, callback) {
    this.storageService.getRecord(constants.PRODUCTS_TABLE, product.gtin, (err, prod) => {
        if (prod) {
          return callback(undefined, undefined);
        }

        this.logService.log({
            logInfo: product,
            username: this.model.username,
            action: `Transferred product from ${product.manufName}`,
            logType: "PRODUCT_LOG",
          }, (err) => {
            if (err) {
              return callback(err);
            }
            product.transferred = false;
            this.storageService.insertRecord(constants.PRODUCTS_TABLE, `${product.gtin}`, product,
              () => {
                this.goToFirstTablePage();
              }
            );
          }
        );
      }
    );
  }
}
