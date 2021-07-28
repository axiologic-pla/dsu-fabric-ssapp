const securityContext = require("opendsu").loadApi("sc");

function cloneFolder(srcPath, destPath, callback) {
    if (srcPath.endsWith("/")) {
        srcPath = srcPath.slice(0, -1);
    }
    if (destPath.endsWith("/")) {
        destPath = destPath.slice(0, -1);
    }
    securityContext.getMainDSU((err, mainDSU) => {
        if (err) {
            return callback(err);
        }
        mainDSU.cloneFolder(srcPath, destPath, {ignoreMounts: false}, callback);
    })
}

function mountDSU(path, keySSI, callback) {
    securityContext.getMainDSU((err, mainDSU) => {
        if (err) {
            return callback(err);
        }
        mainDSU.mount(path, keySSI, callback);
    });
}

module.exports = {
    cloneFolder,
    mountDSU
}
