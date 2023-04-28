import constants from "../../scripts/constants.js";

customElements.define(
  "dsu-tab-panel",
  class _ extends HTMLElement {
    static observedAttributes = ["selected-index", "direction"];
    #selectedIndex = 0;
    #direction = "row";

    constructor() {
      super();
      this.bind(this);
      this.render();
      this.cacheDom();
      this.attachEvents();
      this.setAttribute("selectedIndex", this.#selectedIndex);
      this.dom.tabs[this.#selectedIndex]?.classList.add("selected");
      this.dom.contents[this.#selectedIndex]?.classList.add("selected");
    }

    bind(element) {
      element.render = element.render.bind(element);
      element.attachEvents = element.attachEvents.bind(element);
      element.cacheDom = element.cacheDom.bind(element);
      element.onTabClick = element.onTabClick.bind(element);
      element.selectTabByIndex = element.selectTabByIndex.bind(element);
      element.onContentSlotChange = element.onContentSlotChange.bind(element);
      element.onTabSlotChange = element.onTabSlotChange.bind(element);
    }

    render() {
      this.shadow = this.attachShadow({mode: "open"});
      this.shadow.innerHTML = `
                 <link rel="stylesheet" href="./components/tab-navigator/dsu-tab-panel.css">
                <div class="tabs">
                    <slot id="tab-slot" name="tab" class="tab-header"></slot>
                </div>
                <div class="tab-contents">
                    <slot id="content-slot" name="content"></slot>
                </div>
            `;
    }

    cacheDom() {
      this.dom = {
        tabSlot: this.shadow.querySelector("#tab-slot"),
        contentSlot: this.shadow.querySelector("#content-slot")
      };
      this.dom.tabs = this.dom.tabSlot.assignedElements();
      this.dom.contents = this.dom.contentSlot.assignedElements();
    }

    attachEvents() {
      this.dom.tabSlot.addEventListener(constants.HTML_EVENTS.CLICK, this.onTabClick);
      this.dom.tabSlot.addEventListener(constants.HTML_EVENTS.SLOTCHANGE, this.onTabSlotChange);
      this.dom.contentSlot.addEventListener(constants.HTML_EVENTS.SLOTCHANGE, this.onContentSlotChange);
    }

    onTabSlotChange() {
      this.dom.tabs = this.dom.tabSlot.assignedElements();
    }

    onContentSlotChange() {
      this.dom.contents = this.dom.contentSlot.assignedElements();
    }

    onTabClick(e) {
      const target = e.target;
      if (target.slot === "tab") {
        const tabIndex = this.dom.tabs.indexOf(target);
        this.selectTabByIndex(tabIndex);
      }
    }

    selectTabByIndex(index) {
      const tab = this.dom.tabs[index];
      const content = this.dom.contents[index];
      this.setAttribute("selectedIndex", index);
      if (!tab || !content) return;
      this.dom.contents.forEach(p => p.classList.remove("selected"));
      this.dom.tabs.forEach(p => p.classList.remove("selected"));
      content.classList.add("selected");
      tab.classList.add("selected");

    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue !== newValue) {
        if (name === "selected-index") {
          this.selectedIndex = newValue;
        } else {
          this[name] = newValue;
        }
      }
    }

    set selectedIndex(value) {
      this.#selectedIndex = value;
    }

    get selectedIndex() {
      return this.#selectedIndex;
    }

    set direction(value) {
      this.#direction = value;
      this.setAttribute("direction", value);
    }

    get direction() {
      return this.#direction;
    }
  }
);
