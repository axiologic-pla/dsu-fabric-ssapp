function attachHandlers(controller, datasource) {
  let searchInput = controller.querySelector("#code-search");
  let foundIcon = controller.querySelector(".fa-check");
  let notFoundIcon = controller.querySelector(".fa-ban");
  if (searchInput) {
    searchInput.addEventListener("search", async (event) => {
      await controller.model[datasource].searchHAndler(event.target.value, foundIcon, notFoundIcon)
    })
  }


  controller.onTagClick("prev-page", (model, target, event) => {
    target.parentElement.querySelector(".next-page-btn").disabled = false;
    controller.model[datasource].goToPreviousPage();
    if (controller.model[datasource].getCurrentPageIndex() === 1) {
      target.parentElement.querySelector(".prev-page-btn").disabled = true;
    }

  })
  controller.onTagClick("next-page", (model, target, event) => {

    target.parentElement.querySelector(".prev-page-btn").disabled = false;
    if (controller.model[datasource].hasMoreLogs) {
      controller.model[datasource].goToNextPage();
    }

  })
}

export default {
  attachHandlers
}
