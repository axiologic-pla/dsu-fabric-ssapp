import scriptUtils from "../utils.js";

class HolderService {

    ensureHolderInfo(callback) {
        function getJSON(pth, callback){
            scriptUtils.fetch(pth).then((response) => {
                return response.json();
            }).then((json) => {
                return callback(undefined, json)
            }).catch(callback);
        }

        if (typeof this.holderInfo === "undefined") {
            getJSON("/download/myKeys/holder.json", (err, holderInfo) => {
                if (err) {
                    return callback(Error("No holder info available!"));
                }
                debugger;
                if(!holderInfo.subdomain){
                    holderInfo.subdomain = holderInfo.domain;
                }

                this.holderInfo = holderInfo;
                return callback(undefined, holderInfo);
            });
        } else {
            callback(undefined, this.holderInfo);
        }
    }

}
let instance;
export default {
    getHolderService: function () {
        if(typeof instance ==="undefined"){
            instance =  new HolderService();
        }
        return instance;
    }
}