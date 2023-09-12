import constants from "../constants.js";

function attachHandlers(controller, datasource, searchInputSelector = "#code-search", prevPageTag = "prev-page", nextPageTag = "next-page") {
  let searchInput = controller.querySelector(searchInputSelector || "#code-search");
  let foundIcon = searchInput.parentElement.querySelector(".fa-check");
  let notFoundIcon = searchInput.parentElement.querySelector(".fa-ban");
  if (searchInput) {
    /*clean all listeners and attach new listener */
    let new_element = searchInput.cloneNode(true);
    new_element.addEventListener(constants.HTML_EVENTS.SEARCH, async (event) => {
      window.WebCardinal.loader.hidden = false;
      await controller.model[datasource].searchHandler(event.target.value, foundIcon, notFoundIcon);
      window.WebCardinal.loader.hidden = true;
    })
    searchInput.parentNode.replaceChild(new_element, searchInput);
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
