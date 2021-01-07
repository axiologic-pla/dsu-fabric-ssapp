const CREDENTIAL_FILE_PATH = "/myKeys/credential.json";
const SHARED_DB = "sharedDB";

export default class SharedStorage{
    constructor(dsuStorage) {
        this.DSUStorage = dsuStorage;
        this.mydb = window.sharedDbCache;
        if(this.mydb == undefined){
            this.getSharedSSI( (err,sharedSSI) => {
                if(!err && sharedSSI){
                    let opendsu = require("opendsu");
                    let db = opendsu.loadAPI("db");
                    this.mydb = db.getSharedDB(sharedSSI, SHARED_DB);
                    window.sharedDbCache = this.mydb;
                } else {
                    alert("Wrong configuration as user/holder:" + err);
                }
            })
        }
    }

    waitForDb(func, args){
        func = func.bind(this)
        setTimeout(function(){
            func(...args);
        }, 10);
    }

    getItem(key, callback) {
        if(this.mydb !== undefined){
            this.mydb.getRecord(SHARED_DB,key,callback);
        } else {
            this.waitForDb(this.getItem, [key,callback]);
        }
    }

    setItem(key, value,  callback) {
        if(this.mydb){
            this.mydb.updateRecord(SHARED_DB,key,value, callback);
        } else {
            this.waitForDb(this.setItem, [key,value,callback]);
        }
    }

    getRecord(recordType, key, callback){
        throw Error("Not implemented")
    }

    setRecord(recordType, key, value, callback){
        throw Error("Not implemented")
    }

    getSharedSSI(callback){
        this.DSUStorage.getObject(CREDENTIAL_FILE_PATH, (err, credential) => {
            console.log("Got:", err, credential);
            if (err || !credential) {
                return callback(createOpenDSUErrorWrapper(Error("Invalid credentials")));
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