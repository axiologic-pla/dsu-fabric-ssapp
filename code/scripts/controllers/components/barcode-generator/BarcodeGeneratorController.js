const {FwController} = WebCardinal.controllers;
const TWO_D_BARCODES = ["datamatrix", "gs1datamatrix", "qrcode"];
import bwipjs from "./lib/bwip.js";

export default class BarcodeGeneratorController extends FwController {
  constructor(...props) {
    super(...props);
    this.drawQRCodeCanvas();
  }

  drawQRCodeCanvas() {
    if (this.model.barcodeData.length > 0) {
      let canvas = this.element.querySelector("canvas");
      canvas.innerHTML = "";

      let tryToGenerateBarcode = () => {
        // @ts-ignore
        if (bwipjs) {
          try {
            let options = {
              bcid: this.model.barcodeType || "qrcode",      // Barcode type
              text: this.model.barcodeData,      // Text to encode
              scale: 3,             // 3x scaling factor
              height: this.model.barcodeSize || 32,    // Bar height, in millimeters
              textxalign: 'center', // Always good to set this
            }

            if (this.model.includeBarcodeText) {
              options['alttext'] = this.model.barcodeData;
            }

            if (TWO_D_BARCODES.indexOf(this.model.barcodeType) !== -1) {
              options['width'] = this.model.barcodeSize;
            }

            // @ts-ignore
            bwipjs.toCanvas(canvas, options, function (err) {
              if (err) {
                console.log(err);
              }
            });
          } catch (e) {
            // most commonly errors come from wrong input data format
          }

        } else {
          setTimeout(tryToGenerateBarcode, 100);
        }
      }
      tryToGenerateBarcode();
    }
  }
}
