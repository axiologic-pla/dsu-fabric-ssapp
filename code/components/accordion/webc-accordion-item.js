const template = document.createElement('template');

template.innerHTML = `
<style>
* {
  box-sizing: border-box;
}
.accordion-item {
 padding: 1em 1em 0.15em 1em;
 }
 
 .accordion-item-title{
     padding: 0.45em 0.25em;
 }
 
.accordion-item-content {
  display: block;
  height: 100%;
  width: 100%;
}

.accordion-item-title:after {
    content: '';
    height: 10px;
    width: 10px;
    border-right: 3px solid #23303d;
    border-top: 3px solid #23303d;
    transform: rotate(45deg);
    position: absolute;
    right: 20px;
    transition: all .3s ease;
}
.accordion-item-title:after {
  transform: rotate(135deg);
}

.accordion-item .accordion-item-content {
  display: block;
  position: relative;
  height: 0px;
  transition: all .3s ease;
  overflow: hidden;
}
.accordion-item.active .accordion-item-title:after {
  transform: rotate(45deg);
}
.accordion-item.active .accordion-item-content {
  height: 100%;
}

</style>
<div class="accordion-item">
    <div class="accordion-item-title" part="acc-item-title"><slot name="accordion-item-title"/></div>
    <div class="accordion-item-content" part="acc-item-content"><slot name="accordion-item-content"/></div>
</div>
`;

export default class WebcAccordionItem extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    if (this.classList.contains("active")) {
      this.shadowRoot.querySelector('.accordion-item').classList.add("active")
    }
  }

  toggle(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    this.dispatchEvent(new Event('webc-accordion-item:toggle', {bubbles: true}));
  }

  connectedCallback() {
    this.shadowRoot.querySelector('.accordion-item-title').addEventListener('click', this.toggle.bind(this));
  }

  disconnectedCallback() {
    this.shadowRoot.querySelector('.accordion-item-title').removeEventListener("click", this.toggle);
  }
}
