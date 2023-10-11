const gtinResolver = require("gtin-resolver");
const LeafletService = gtinResolver.DSUFabricUtils;
const utils = require("gtin-resolver").utils;

//other rtl language codes to be used for later:  "arc", "arz", "ckb", "dv", "fa", "ha", "he", "khw", "ks", "ps", "sd", "ur", "uz_AF", "yi"
let rtlLangCodes = ["ar", "he"];


async function getPreviewModel(model, selectedLeafletCard) {
  let previewModalTitle = `Preview ${selectedLeafletCard.language.label} ${selectedLeafletCard.type.label}`;

  let productName;
  let productDescription;
  if (model.batch) {
    productName = model.batch.productName;
    productDescription = model.productDescription;
  } else {
    productName = model.product.name;
    productDescription = model.product.description;
  }
  productName = productName || "Brand/invented name is empty";
  productDescription = productDescription || "Name of Medicinal Product is empty";

  let {xmlContent, leafletImages} = await getEpiContent(model, selectedLeafletCard);
  let epiData = {xmlContent, leafletImages, productName, productDescription};
  let textDirection = "LTR";
  if (rtlLangCodes.find((rtlLAng) => rtlLAng === selectedLeafletCard.language.value)) {
    textDirection = "RTL"
  }

  return {previewModalTitle, epiData, textDirection};
}

async function getEpiContent(model, selectedLeafletCard) {

  let xmlContent;
  let leafletImages = {};
  let {gtinSSI, mountPath} = await LeafletService.getDSUBaseInfo(model);
  const openDSU = require("opendsu");
  const resolver = openDSU.loadAPI("resolver");
  let constDSU;
  if (selectedLeafletCard.files && typeof selectedLeafletCard.files[0] === "string") {
    const openDSU = require("opendsu");
    const resolver = openDSU.loadAPI("resolver");
    constDSU = await $$.promisify(resolver.loadDSU)(gtinSSI);
  }

  for (let file of selectedLeafletCard.files) {
    if (typeof file !== "object") {
      //TODO create a service to get leaflet content and unify with get-leaflet api endpoint
      let fileContent = await $$.promisify(constDSU.readFile)(`${mountPath}/${selectedLeafletCard.type.value}/${selectedLeafletCard.language.value}/${file}`);

      if (file.endsWith('.xml')) {
        xmlContent = fileContent.toString();
      } else {
        leafletImages[file] = utils.getImageAsBase64(fileContent)
      }
    } else {
      if (!file.name) {
        continue;
      }
      if (file.name.endsWith('.xml')) {
        xmlContent = await LeafletService.getFileContent(file);
      } else {
        let fileContent = await LeafletService.getFileContentAsBuffer(file);
        leafletImages[file.name] = utils.getImageAsBase64(fileContent);
      }
    }
  }
  return {xmlContent, leafletImages}
}


function getSelectedEpiCard(languageTypeCards, language, type) {
  return languageTypeCards.find(epiCard => {
    return epiCard.type.value === type && epiCard.language.value === language
  })
}

function getSelectedEpiCardIndex(languageTypeCards, language, type) {
  return languageTypeCards.findIndex(epiCard => {
    return epiCard.type.value === type && epiCard.language.value === language
  })
}

export default {
  getPreviewModel,
  getEpiContent,
  getSelectedEpiCard,
  getSelectedEpiCardIndex
}
