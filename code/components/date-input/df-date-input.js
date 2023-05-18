const YEAR_LEADING_ZEROS = {
  0: '',
  1: '0',
  2: '00',
  3: '000'
};

export default class WebcDateInput extends HTMLElement {
  constructor() {
    super();
    this._value = "";
    let style = document.createElement('style');
    style.innerHTML = `
      .formated-date { position: relative; color:transparent!important;} 
      .formated-date:before {  position: absolute;top: 0.45rem;content: attr(data-date);display: inline-block;color:#333333;}
      .formated-date::-webkit-datetime-edit,
      .formated-date::-webkit-inner-spin-button,
      .formated-date::-webkit-clear-button {display: none;} 
      .formated-date::-webkit-calendar-picker-indicator  {position: absolute;top: 0.41rem; right: 0.8rem; opacity: 1;}
    `;
    document.head.appendChild(style);
  }

  async connectedCallback() {
    const component = this.tagName.toLowerCase();
    let container = document.createElement("div")
    container.classList.add("form-group");
    this.inputElement = document.createElement("input");
    this.inputElement.classList.add("form-control");
    for (let i = 0; i < this.attributes.length; i++) {
      const {name, value} = this.attributes[i];
      if (name === "value") {
        continue;
      }
      this.inputElement.setAttribute(name, value);
    }

    if (!this.isSafari()) {
      this.inputElement.classList.add("formated-date");
    } else if (this.inputElement.getAttribute("type") === "month") {
      this.inputElement.placeholder = "yyyy-mm";

    }
    container.append(this.inputElement);
    this.append(container);
    debugger;
    this.inputElement.addEventListener("keyup", this.editDateHandler.bind(this))
    this.inputElement.addEventListener("change", this.editDateHandler.bind(this))
    this.inputElement.addEventListener("focusout", this.focusOutHandler.bind(this))
  }

  editDateHandler(event) {
    event.stopImmediatePropagation();
    if (!this.isSafari()) {
      this.focusOutHandler(event)
    }
  }

  focusOutHandler(event) {
    event.stopImmediatePropagation();
    let currentDate = event.target.value;

    if (currentDate && currentDate.trim().length) {
      const newValue = new Date(currentDate).getTime();
      this.value = newValue;
      const event = new CustomEvent('date-changed', {bubbles: true, detail: newValue});
      this.dispatchEvent(event);
    }

  }

  disconnectedCallback() {
    this.innerHTML = "";
  }

  static get observedAttributes() {
    return ["value"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this.hasAttribute(name)) {
      switch (name) {
        case "value":
          this.value = newValue;
      }
    }
  }

  getFormattedDate = () => {
    if (!this._value) {
      return {};
    }

    let newDate = new Date(parseInt(this._value));
    const utcYear = newDate.getUTCFullYear();
    const utcMonth = newDate.getUTCMonth() + 1;
    const utcDayOfMonth = newDate.getUTCDate();

    const day = utcDayOfMonth <= 9 ? `0${utcDayOfMonth}` : `${utcDayOfMonth}`;
    const month = utcMonth <= 9 ? `0${utcMonth}` : `${utcMonth}`;

    let year = utcYear.toString();
    const leadingZeros = year.length < 4 ? 4 - year.length : 0;
    year = `${YEAR_LEADING_ZEROS[leadingZeros]}${year}`;

    const dateVariables = {
      "DD": day,
      "MM": month,
      "YYYY": year
    };

    let dateValue = "YYYY MM DD".split(' ')
      .map((type) => dateVariables[type])
      .join("-");

    this.dataFormat = this.getAttribute("data-format");

    const formattedDate = this.dataFormat
      ? this.dataFormat.trim()
        .split(/[ ,\/]+/)
        .map((type) => dateVariables[type])
        .join('/')
      : dateValue;

    if (this.inputElement.getAttribute("type") === "month" && dateValue) {
      dateValue = dateValue.substring(0, dateValue.lastIndexOf("-"));
    }
    return {
      dateToDisplay: formattedDate,
      dateToAssign: dateValue
    };
  }

  getBrowser = () => {
    let userAgent = navigator.userAgent, tem,
      M = userAgent.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    if (/trident/i.test(M[1])) {
      tem = /\brv[ :]+(\d+)/g.exec(userAgent) || [];
      return {name: 'IE', version: (tem[1] || '')};
    }
    if (M[1] === 'Chrome') {
      tem = userAgent.match(/\bOPR|Edge\/(\d+)/)
      if (tem != null) {
        return {name: 'Opera', version: tem[1]};
      }
    }
    M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
    if ((tem = userAgent.match(/version\/(\d+)/i)) != null) {
      M.splice(1, 1, tem[1]);
    }
    return {
      name: M[0],
      version: M[1]
    };
  }

  isSafari = () => {
    return this.getBrowser().name.indexOf('Safari') !== -1;
  }

  set value(value) {
    this._value = value;
    if (this.inputElement && value) {
      let {
        dateToDisplay,
        dateToAssign
      } = this.getFormattedDate();
      this.inputElement.setAttribute("data-date", dateToDisplay);
      this.inputElement.value = dateToAssign;
    }

  }

  get value() {
    return this._value;
  }

  set type(value) {
    if (this.inputElement) {
      this.inputElement.type = value;
    }
  }

  get type() {
    return this.inputElement.type;
  }

}



