function attachHandlers(controller, datasource, searchInputSelector = "#code-search", prevPageTag = "prev-page", nextPageTag = "next-page") {
  let searchInput = controller.querySelector(searchInputSelector || "#code-search");
  let foundIcon = controller.querySelector(".fa-check");
  let notFoundIcon = controller.querySelector(".fa-ban");
  if (searchInput) {
    searchInput.addEventListener("search", async (event) => {
      await controller.model[datasource].searchHandler(event.target.value, foundIcon, notFoundIcon)
    })
  }

  controller.onTagClick(prevPageTag, async (model, target, event) => {
    target.parentElement.querySelector(".next-page-btn").disabled = false;
    await controller.model[datasource].goToPreviousPage();
    if (controller.model[datasource].getCurrentPageIndex() === 0) {
      target.parentElement.querySelector(".prev-page-btn").disabled = true;
    }

  })
  controller.onTagClick(nextPageTag, async (model, target, event) => {
    target.parentElement.querySelector(".prev-page-btn").disabled = false;
    if (controller.model[datasource].hasMoreLogs) {
      await controller.model[datasource].goToNextPage();
      if (!controller.model[datasource].hasMoreLogs) {
        target.parentElement.querySelector(".next-page-btn").disabled = true;
      }
    }
  })
}

export default {
  attachHandlers
}
