const template = document.createElement('template');

template.innerHTML = `
<style>
* {
  box-sizing: border-box;
}
.accordion {
   background-color: rgb(255, 255, 255);
   box-shadow: rgba(0, 0, 0, 0.25) 0px 0px 5px;
   display: block;
   border-radius: 4px;
}


</style>
<div class="accordion" part="acc-main">
    <slot id="acc-slot"/>
</div>
`;

export default class WebcAccordion extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({mode: 'open'});
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.dom = {
      componentSlot: this.shadow.querySelector("#acc-slot")
    };
    this.dom.accItems = this.dom.componentSlot.assignedElements();


  }

  toggle(e) {
    const itemIndex = this.dom.accItems.indexOf(e.target);
    if (itemIndex < 0) {
      return;
    }
    this.selectItemByIndex(itemIndex);
  }

  getActiveItemIndex() {
    return this.dom.accItems.findIndex((item) => {
      item.classList.contains("active")
    });
  }

  selectItemByIndex(index) {
    const item = this.dom.accItems[index];

    if (!item) return;
    if (!this._multiple) {
      this.dom.accItems.forEach(p => {
        p.classList.remove("active");
        p.shadowRoot.querySelector(".accordion-item").classList.remove("active");
      });
    }

    if (index !== this.activeItemIndex) {
      item.classList.add("active");
      item.shadowRoot.querySelector(".accordion-item").classList.add("active");
      this.activeItemIndex = index;
    } else {
      this.activeItemIndex = -1;
    }

  }

  connectedCallback() {
    this.shadowRoot.querySelector('.accordion').addEventListener("webc-accordion-item:toggle", this.toggle.bind(this));
    this.dom.componentSlot.addEventListener("slotchange", this.onSlotChange.bind(this));
  }

  onSlotChange() {
    this.dom.accItems = this.dom.componentSlot.assignedElements();
    this.activeItemIndex = this.getActiveItemIndex();
  }

  disconnectedCallback() {
    this.shadowRoot.querySelector('.accordion').removeEventListener("webc-accordion-item:toggle", this.toggle);
  }
}
