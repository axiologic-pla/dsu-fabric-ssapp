class SharedStorage {
  constructor(dsuStorage) {
    const dbAPI = require("opendsu").loadAPI("db");
    dbAPI.getSharedEnclaveDB((err, enclaveDB) => {
      if (err) {
        return console.log(err);
      }
      this.mydb = enclaveDB;
      this.DSUStorage = dsuStorage;
    });
  }

  waitForDb(func, args) {
    func = func.bind(this);
    setTimeout(function () {
      func(...args);
    }, 10);
  }

  dbReady() {
    return this.mydb !== undefined && this.mydb !== "initialising";
  }

  filter(tableName, query, sort, limit, callback) {
    if (this.dbReady()) {
      this.mydb.filter(tableName, query, sort, limit, callback);
    } else {
      this.waitForDb(this.filter, [tableName, query, sort, limit, callback]);
    }
  }

  addSharedFile(path, value, callback) {
    throw Error("Not implemented");
  }

  getRecord(tableName, key, callback) {
    if (this.dbReady()) {
      this.mydb.getRecord(tableName, key, callback);
    } else {
      this.waitForDb(this.getRecord, [tableName, key, callback]);
    }
  }

  addIndex(tableName, field, callback) {
    if (this.dbReady()) {
      console.log("addIndex :", tableName, field);
      this.mydb.addIndex(tableName, field, callback);
    } else {
      this.waitForDb(this.addIndex, [tableName, field, callback]);
    }
  }

  insertRecord(tableName, key, record, callback) {
    if (this.dbReady()) {
      console.log("Insert Record:", tableName, key);
      this.mydb.insertRecord(tableName, key, record, callback);
    } else {
      this.waitForDb(this.insertRecord, [tableName, key, record, callback]);
    }
  }

  updateRecord(tableName, key, record, callback) {
    if (this.dbReady()) {
      this.mydb.updateRecord(tableName, key, record, callback);
    } else {
      this.waitForDb(this.updateRecord, [tableName, key, record, callback]);
    }
  }

  beginBatch() {
    if (this.dbReady()) {
      this.mydb.beginBatch();
    } else {
      this.waitForDb(this.beginBatch);
    }
  }

  cancelBatch(callback) {
    if (this.dbReady()) {
      this.mydb.cancelBatch(callback);
    } else {
      this.waitForDb(this.cancelBatch, [callback]);
    }
  }

  commitBatch(callback) {
    if (this.dbReady()) {
      this.mydb.commitBatch(callback);
    } else {
      this.waitForDb(this.commitBatch, [callback]);
    }
  }

  getKeySSI(callback) {
    if (this.dbReady()) {
      this.mydb.getKeySSI(callback);
    } else {
      this.waitForDb(this.getKeySSI, [callback]);
    }
  }

  refresh(callback) {
    if (this.dbReady()) {
      this.getKeySSI((err, keySSI) => {
        if (err) {
          return callback(err);
        }

        const resolver = require("opendsu").loadAPI("resolver");
        resolver.loadDSU(keySSI, (err, dsuInstance) => {
          if (err) {
            return callback(err);
          }

          dsuInstance.refresh(callback);
        });
      });
    } else {
      this.waitForDb(this.getKeySSI, [callback]);
    }
  }
}

export default function getSharedStorage(dsuStorage) {
  if (typeof window.sharedStorageSingleton === "undefined") {
    window.sharedStorageSingleton = new SharedStorage(dsuStorage);
  }

  return window.sharedStorageSingleton;
}
