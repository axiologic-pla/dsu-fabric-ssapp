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
    window.sharedStorageSingleton = sharedEnclave;
    callback(undefined, window.sharedStorageSingleton);
  })
}
