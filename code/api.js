const securityContext = require("opendsu").loadApi("sc");
const mainDSU = securityContext.getMainDSU();

function cloneFolder(srcPath, destPath, callback) {
    if (srcPath.endsWith("/")) {
        srcPath = srcPath.slice(0, -1);
    }
    if (destPath.endsWith("/")) {
        destPath = destPath.slice(0, -1);
    }
    mainDSU.cloneFolder(srcPath, destPath,  {ignoreMounts: false}, callback);
}

module.exports = {
    cloneFolder
}

/*
this.DSUStorage.call("cloneFolder", previousPath, currentPath (err) => {
                if (err) {
                    return callback(err);
                }

                callback();
            })
 */