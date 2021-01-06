import constants from '../constants.js';
import SharedStorage from "./SharedDBStorageService.js";

export default class LogService {

	constructor(dsuStorage) {
		this.storageService = new SharedStorage(dsuStorage);
	}

	log (logDetails) {
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
			this.storageService.setItem(constants.LOGS_TABLE, JSON.stringify(logs), (err) => {
				if (err) {
					return console.log("Error adding a log.")
				}
			});
		})
	}

	getLogs (callback) {
		this.storageService.getItem(constants.LOGS_TABLE, (err, logs) => {
			if (err) {
				return callback(err);
			}

			if (typeof logs === "undefined" || logs === null) {
				return callback(undefined, []);
			}
			callback(undefined, logs)
		});
	}
}