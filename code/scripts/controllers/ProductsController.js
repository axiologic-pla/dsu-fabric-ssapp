const {WebcController} = WebCardinal.controllers;
import constants from "../constants.js";
import getSharedStorage from '../services/SharedDBStorageService.js';
import utils from "../utils.js";
import LogService from "../services/LogService.js";
import Product from "../models/Product.js";

export default class ProductsController extends WebcController {
  constructor(element, history) {
    super(element, history);

    this.setModel({});
    this.storageService = getSharedStorage(this.DSUStorage);
    this.logService = new LogService(this.DSUStorage);

    this.model.addExpression('productsListLoaded', () => {
      return typeof this.model.productsForDisplay !== "undefined";
    }, 'productsForDisplay');

    this.storageService.filter(constants.PRODUCTS_TABLE, "__timestamp > 0", (err, products) => {
        if (err) {
            return console.log(err);
        }
        this.products = products;
        this.model.productsForDisplay = products;
    });

    this.onTagClick("sort-data", (model, target, event) => {
      let activeSortButtons = this.element.querySelectorAll('.sort-button.active')

      if (activeSortButtons.length > 0) {
        activeSortButtons.forEach(elem => {
          if (elem !== target)
            elem.classList.remove("active");
        })
      }
      target.classList.add("active");
      let sortCriteria = JSON.parse(target.getAttribute('event-data'));
      this.model.productsForDisplay.sort(utils.sortByProperty(sortCriteria.property, sortCriteria.direction));
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
                  acceptButtonText: 'Accept',
                  mah: "",
                  denyButtonText: 'Cancel'
              }

              this.showModalFromTemplate("transfer-product-modal",
                  (event) => {
                      product.transferred = true;
                      product.manufName = this.model.actionModalModel.mah;
                      this.logService.log({
                          logInfo: product,
                          username: this.model.username,
                          action: `Transferred product to ${this.model.actionModalModel.mah}`,
                          logType: 'PRODUCT_LOG'
                      }, () => {
                      });
                  },

                  (event) => {
                      return
                  },
                  {model: this.model})

          })
      });

    this.onTagClick("get-transferred-product", (event) => {
      this.model.actionModalModel = {
        title: "Add transferred product",
        acceptButtonText: 'Accept',
        denyButtonText: 'Cancel',
        transferCode: ""
      }
      this.showModalFromTemplate('get-transferred-product-modal',
        (response)=>{
          if ( this.model.actionModalModel.transferCode === undefined) {
            return;
          }
          const product = JSON.parse($$.Buffer.from(this.model.actionModalModel.transferCode, "base64").toString());
          this.addProductToProductsList(new Product(product), (err) => {
            if (err) {
              return console.log(err);
            }
                    this.storageService.filter(constants.PRODUCTS_TABLE, "__timestamp > 0", (err, products) => {
                        this.products = products;
                        this.model.productsForDisplay = products;
                    });
          });

        }, (err) => {return},
        {model: this.model});
    });

    this.onTagClick('edit-product', (model, target, event) => {
      const gtin = event.target.getAttribute("gtin");
      this.navigateToPageTag("manage-product", {gtin: gtin});
    }, {capture: true});


    this.on("view-drug", (event) => {
      this.navigateToPageTag("drug-details");
    });

    this.on('openFeedback', (e) => {
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
      logType: 'PRODUCT_LOG'
    }, (err) => {
      if (err) {
        return callback(err);
      }
                product.transferred = false;
                this.storageService.insertRecord(constants.PRODUCTS_TABLE, `${product.gtin}`, product, () => {
                });
            });
    });
  }
}
