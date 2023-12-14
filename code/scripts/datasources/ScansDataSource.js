import {LazyDataSource} from "./LazyDataSource.js";
import utils from "../utils.js";

export default class ScansDataSource extends LazyDataSource {
  constructor(...props) {
    super(...props);
    let self = this;

    function refresh(noUiUpdate) {
      if (!noUiUpdate) {
        setTimeout(async () => {
          await self.forceUpdate(true);
        }, 0)

      }
      setTimeout(() => {
        self.storageService.onCommitBatch(refresh);
      })
    }

    refresh(true);
  }

  getMappedResult(data) {
    let now = Date.now();
    return data.map(item => {
      item.timeAgo = utils.timeAgo(item["__timestamp"]);
      item.nrOfMissingDataScans = item.missingDataScans.length;
      item.nrOfMissingKeyScans = item.missingKeyScans.length;
      return item;
    })
  }
}
