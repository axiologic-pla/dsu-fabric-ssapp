const {DataSource} = WebCardinal.dataSources;

/*
*  customOptions is an object with 3 properties:
*  storageService - sharedStorage
*  tableName - db table to work with
*  searchField - db field to search on;
*
* */

export class LazyDataSource extends DataSource {
  constructor(...props) {
    const [customOptions, ...defaultOptions] = props;
    super(...defaultOptions);
    this.itemsOnPage = 15;
    this.storageService = customOptions.storageService;
    this.tableName = customOptions.tableName;
    this.searchField = customOptions.searchField;
    this.name = customOptions.dataSourceName;
    this.callback = customOptions.onGetDataCallback;
    this.setPageSize(this.itemsOnPage);
    this.dataSourceRezults = [];
    this.hasMoreLogs = false;
    this.filterResult = [];
    this.hasResults = false;
  }

  async searchHandler(inputValue, foundIcon, notFoundIcon) {
    notFoundIcon.style.display = "none";
    foundIcon.style.display = "none";
    if (inputValue) {
      try {
        await $$.promisify(this.storageService.refresh, this.storageService)();
      } catch (err) {
        //ignorable error when legacyDSU
      }

      let result = await $$.promisify(this.storageService.filter, this.storageService)(this.tableName, ["__timestamp > 0", `${this.searchField} == ${inputValue}`], "dsc");

      if (result && result.length > 0) {
        foundIcon.style.display = "inline";
        this.filterResult = result;
        this.forceUpdate(true);
      } else {
        notFoundIcon.style.display = "inline";
      }
    } else {
      this.filterResult = [];
      this.forceUpdate(true);
    }
  }

  getMappedResult(data) {
    if (this.dataSourceRezults.length > 0) {
      this.hasResults = true;
    }
    if (this.callback && typeof this.callback === "function") {
      this.callback()
    }
    return data;
  }

  async getPageDataAsync(startOffset, dataLengthForCurrentPage) {
    if (this.filterResult.length > 0) {
      document.querySelector(".pagination-container").hidden = true;
      return this.getMappedResult(this.filterResult);
    }
    let resultData = [];

    try {
      if (this.dataSourceRezults.length > 0) {
        let moreItems = await $$.promisify(this.storageService.filter, this.storageService)(this.tableName, `__timestamp < ${this.dataSourceRezults[this.dataSourceRezults.length - 1].__timestamp}`, "dsc", this.itemsOnPage);
        if (moreItems && moreItems.length > 0 && moreItems[moreItems.length - 1].pk !== this.dataSourceRezults[this.dataSourceRezults.length - 1].pk) {
          this.dataSourceRezults = [...this.dataSourceRezults, ...moreItems,];
        }
      } else {
        try {
          await $$.promisify(this.storageService.refresh, this.storageService)();
        } catch (err) {
          //ignorable error when legacyDSU
        }
        this.dataSourceRezults = await $$.promisify(this.storageService.filter, this.storageService)(this.tableName, "__timestamp > 0", "dsc", this.itemsOnPage * 2);
      }

      resultData = this.dataSourceRezults.slice(startOffset, startOffset + dataLengthForCurrentPage);
      this.hasMoreLogs = this.dataSourceRezults.length >= startOffset + dataLengthForCurrentPage + 1;

      if (document.querySelector(`.pagination-container.${this.name}-datasource`)) {
        document.querySelector(`.pagination-container.${this.name}-datasource`).hidden = this.dataSourceRezults.length <= this.itemsOnPage
      }

      if (document.querySelectorAll(".search-container")) {
        document.querySelectorAll(".search-container").forEach(item => {
          item.hidden = resultData.length === 0;
        })
      }

    } catch (e) {
      console.log("Error on get async page data  ", e);
    }

    return this.getMappedResult(resultData);
  }


}
