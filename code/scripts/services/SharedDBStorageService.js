const CREDENTIAL_FILE_PATH = "/myKeys/credential.json";
const SHARED_DB = "sharedDB";

export default class SharedStorage{
    constructor(dsuStorage) {
        this.mydb = window.sharedDbCache;
        this.DSUStorage = dsuStorage;
        this.DSUStorage.enableDirectAccess( ()=>{
            if(this.mydb == undefined){
                this.getSharedSSI( (err,sharedSSI) => {
                    if(!err && sharedSSI){
                        let opendsu = require("opendsu");
                        let db = opendsu.loadAPI("db");
                        this.mydb = db.getWalletDB(sharedSSI, SHARED_DB);
                        window.sharedDbCache = this.mydb;
                    } else {
                        alert("Wrong configuration as user/holder:" + err);
                    }
                })
            }
        });
    }

    waitForDb(func, args){
        func = func.bind(this)
        setTimeout(function(){
            func(...args);
        }, 10);
    }


    getArray(tableName, query, sort, limit, callback) {
        if(this.mydb !== undefined){
            this.mydb.filter(tableName, query, sort, limit, callback);
        } else {
            this.waitForDb(this.getArray, [tableName, query, sort, limit, callback]);
        }
    }

    addSharedFile(path, value, callback){
        throw Error("Not implemented")
    }

    getRecord(tableName, key, callback){
        if(this.mydb){
            this.mydb.getRecord(tableName, key, callback);
        } else {
            this.waitForDb(this.getRecord, [tableName, key, callback]);
        }
    }

    insertRecord(tableName, key, record, callback){
        if(this.mydb){
            console.log("Insert Record:", tableName, key);
            this.mydb.insertRecord(tableName, key, record, callback);
        } else {
            this.waitForDb(this.insertRecord, [tableName, key, record, callback]);
        }
    }

    updateRecord(tableName, key, record, callback){
        if(this.mydb){
            this.mydb.updateRecord(tableName, key, record, callback);
        } else {
            this.waitForDb(this.updateRecord, [tableName, key, record, callback]);
        }
    }

    getSharedSSI(callback){
        this.DSUStorage.getObject(CREDENTIAL_FILE_PATH, (err, credential) => {
            console.log("Got:", err, credential);
            if (err || !credential) {
                return callback(createOpenDSUErrorWrapper("Invalid credentials", err));
            } else {
                const crypto = require("opendsu").loadApi("crypto");
                const keyssi = require("opendsu").loadApi("keyssi");
                crypto.parseJWTSegments(credential.credential, (parseError, jwtContent) => {
                    if (parseError) {
                        return callback(createOpenDSUErrorWrapper('Error parsing user credential:',parseError));
                    }
                    console.log('Parsed credential', jwtContent);
                    callback(undefined, keyssi.parse(jwtContent.body.iss));
                });
            }
        });
    }
}