import constants from "../constants.js";
export default function getSharedStorage(callback) {
  if (typeof window.sharedStorageSingleton !== "undefined") {
    return callback(undefined, window.sharedStorageSingleton);
  }

  const openDSU = require("opendsu");
  const scAPI = openDSU.loadAPI("sc");
  scAPI.getSharedEnclave((err, sharedEnclave) => {
    if (err) {
      return callback(err);
    }

    sharedEnclave.addIndex(constants.PRODUCTS_TABLE, "gtin", err => {
      if (err) {
        return callback(err);
      }

      sharedEnclave.addIndex(constants.BATCHES_STORAGE_TABLE, "gtin", err => {
        if (err) {
          return callback(err);
        }
        sharedEnclave.addIndex(constants.PRODUCTS_TABLE, "__timestamp", err => {
          if (err) {
            return callback(err);
          }

          sharedEnclave.addIndex(constants.BATCHES_STORAGE_TABLE, "__timestamp", err => {
            if (err) {
              return callback(err);
            }

            window.sharedStorageSingleton = sharedEnclave;
            callback(undefined, window.sharedStorageSingleton);
          })
        })
      })
    })
  })
}
