import constants from '../constants.js';
import SharedStorage from "./SharedDBStorageService.js";

export default class LogService {

	constructor(dsuStorage, logsTable) {
		this.storageService = new SharedStorage(dsuStorage);
		if (typeof logsTable === "undefined") {
			this.logsTable = constants.LOGS_TABLE;
		} else {
            this.logsTable = logsTable;
        }
	}

	log (logDetails, callback) {
		if (logDetails === null || logDetails === undefined) {
			return;
		}
		this.getLogs((err, logs) => {
			if (err) {
				return console.log("Error retrieving logs.")
			}
			logs.push({
				...logDetails,
				timestamp: new Date().getTime()
			});
			this.storageService.setArray(this.logsTable, logs, (err) => {
				if (err) {
					return console.log("Error adding a log.")
				}
				callback(err, true);
			});
		})
	}

	getLogs (callback) {
		this.storageService.getArray(this.logsTable, callback);
	}
}