const gtinResolver = require("gtin-resolver");
const LeafletService = gtinResolver.DSUFabricUtils;
const utils = require("gtin-resolver").utils;

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
  return {previewModalTitle, epiData};
}

async function getEpiContent(model, selectedLeafletCard) {

  let xmlContent;
  let leafletImages = {};
  for (let file of selectedLeafletCard.files) {
    if (typeof file !== "object") {
      //TODO create a service to get leaflet content and unify with get-leaflet api endpoint
      let fileContent = await LeafletService.getLeafletFile(selectedLeafletCard.type.value, selectedLeafletCard.language.value, file, model);
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
