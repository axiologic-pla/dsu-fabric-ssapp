import constants from "../constants.js";
import Product from "../models/Product.js";
import ProductsDataSource from "../datasources/ProductsDataSource.js"
import lazyUtils from "../helpers/lazy-data-source-utils.js";

const {FwController} = WebCardinal.controllers;

const LogService = require("gtin-resolver").loadApi("services").LogService;


export default class ProductsController extends FwController {
  constructor(element, history) {
    super(element, history);
    this.model = {userrights: this.userRights};

    this.logService = new LogService();
    this.model.prodDataSource = new ProductsDataSource({
      storageService: this.storageService,
      tableName: constants.PRODUCTS_TABLE,
      searchField: "gtin",
      dataSourceName: "products"
    });

    lazyUtils.attachHandlers(this, "prodDataSource");

    this.onTagClick("add-product", async (model, target, event) => {
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
                  productCode: product.gtin
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
              return this.notificationHandler.reportUserRelevantError("Failed to add product to product list. ", err);
            }
          });
        }, (err) => {
          return;
        },
        {model: this.model}
      );
    });

    this.onTagClick("edit-product", async (model, target, event) => {
        const gtin = event.target.getAttribute("gtin");

        this.navigateToPageTag("manage-product", {
          gtin: gtin
        });
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
            productCode: product.gtin
          }, (err) => {
            if (err) {
              return callback(err);
            }
            product.transferred = false;
            this.storageService.safeBeginBatch(err => {
                this.storageService.insertRecord(constants.PRODUCTS_TABLE, `${product.gtin}`, product,
                    async () => {
                        this.model.prodDataSource.forceUpdate(true);
                        await this.storageService.commitBatchAsync();
                    });
                })
          }
        );
      }
    );
  }
}
