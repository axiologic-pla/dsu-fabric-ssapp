import constants from "./constants.js";


function getDateWithTimeZone(dateString) {
  const timeZoneOffset = new Date(dateString).getTimezoneOffset() * 60 * 1000;
  return new Date(dateString).getTime() + timeZoneOffset;
}

function convertDateToShortISO(dateString) {
  let {y, m, d} = getYYYYMMdd(dateString);
  return `${y}-${m}-${d}`
}

function getYYYYMMdd(dateString) {
  let dt = new Date(getDateWithTimeZone(dateString));
  const year = dt.getFullYear();
  const month = ("0" + (dt.getMonth() + 1)).slice(-2);
  const day = ("0" + dt.getDate()).slice(-2);
  return {y: year, m: month, d: day}
}

function convertDateFromISOToGS1Format(isoDateString, separator) {
  const date = new Date(getDateWithTimeZone(isoDateString));
  const ye = new Intl.DateTimeFormat('en', {year: '2-digit'}).format(date);
  const mo = new Intl.DateTimeFormat('en', {month: '2-digit'}).format(date);
  const da = new Intl.DateTimeFormat('en', {day: '2-digit'}).format(date);
  if (separator) {
    return `${ye}${separator}${mo}${separator}${da}`
  }
  return `${ye}${mo}${da}`;
}

function convertDateToGS1Format(dateString, useDay) {
  let gs1Date = convertDateFromISOToGS1Format(convertDateToShortISO(dateString));
  if (!useDay) {
    gs1Date = gs1Date.slice(0, -2) + "00";
  }
  return gs1Date
}

function getIgnoreDayDate(dateString) {
  let {y, m, d} = getYYYYMMdd(dateString);
  const lastMonthDay = new Date(y, m, 0).getDate();
  const gmtDate = new Date(y + '-' + m + '-' + lastMonthDay + 'T00:00:00Z');
  return gmtDate.getTime();
}

function convertDateTOGMTFormat(date) {
  let formatter = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    weekday: "short",
    monthday: "short",
    timeZone: 'GMT'
  });

  let arr = formatter.formatToParts(date);
  let no = {};
  arr.forEach(item => {
    no[item.type] = item.value;
  })
  let {year, month, day, hour, minute} = no;

  let offset = -date.getTimezoneOffset();
  let offset_min = offset % 60;
  if (!offset_min) {
    offset_min = "00"
  }
  offset = offset / 60;
  let offsetStr = "GMT ";
  if (offset) {
    if (offset > 0) {
      offsetStr += "+";
    }
    offsetStr += offset;
    offsetStr += ":";
    offsetStr += offset_min;
  }

  return `${year} ${month} ${day} ${hour}:${minute} ${offsetStr}`;
}

function getFetchUrl(relativePath) {
  if (window["$$"] && $$.SSAPP_CONTEXT && $$.SSAPP_CONTEXT.BASE_URL && $$.SSAPP_CONTEXT.SEED) {
    // if we have a BASE_URL then we prefix the fetch url with BASE_URL
    return `${new URL($$.SSAPP_CONTEXT.BASE_URL).pathname}${
      relativePath.indexOf("/") === 0 ? relativePath.substring(1) : relativePath
    }`;
  }
  return relativePath;
}

function executeFetch(url, options) {
  const fetchUrl = getFetchUrl(url);
  return fetch(fetchUrl, options);
}


function sortByProperty(property, direction) {
  return (a, b) => {
    if (("" + a[property]) < ("" + b[property])) {
      return direction === "asc" ? -1 : 1;
    }
    if (("" + a[property]) > ("" + b[property])) {
      return direction === "asc" ? 1 : -1;
    }
    return 0;
  }
}

const bytesToBase64 = (bytes) => {
  const base64abc = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
    "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "/"
  ];

  let result = '', i, l = bytes.length;
  for (i = 2; i < l; i += 3) {
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
    result += base64abc[((bytes[i - 1] & 0x0F) << 2) | (bytes[i] >> 6)];
    result += base64abc[bytes[i] & 0x3F];
  }
  if (i === l + 1) { // 1 octet yet to write
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[(bytes[i - 2] & 0x03) << 4];
    result += "==";
  }
  if (i === l) { // 2 octets yet to write
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
    result += base64abc[(bytes[i - 1] & 0x0F) << 2];
    result += "=";
  }
  return result;
}

function sanitizeCode(code) {
  return code.replace(/"/g, "\\\"");
}

function timeAgo(time) {

  switch (typeof time) {
    case 'number':
      break;
    case 'string':
      time = +new Date(time);
      break;
    case 'object':
      if (time.constructor === Date) time = time.getTime();
      break;
    default:
      time = +new Date();
  }
  const time_formats = [
    [60, 'seconds', 1], // 60
    [120, '1 minute ago', '1 minute from now'], // 60*2
    [3600, 'minutes', 60], // 60*60, 60
    [7200, '1 hour ago', '1 hour from now'], // 60*60*2
    [86400, 'hours', 3600], // 60*60*24, 60*60
    [172800, 'Yesterday', 'Tomorrow'], // 60*60*24*2
    [604800, 'days', 86400], // 60*60*24*7, 60*60*24
    [1209600, 'Last week', 'Next week'], // 60*60*24*7*4*2
    [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
    [4838400, 'Last month', 'Next month'], // 60*60*24*7*4*2
    [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
    [58060800, 'Last year', 'Next year'], // 60*60*24*7*4*12*2
    [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
    [5806080000, 'Last century', 'Next century'], // 60*60*24*7*4*12*100*2
    [58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
  ];
  let seconds = (+new Date() - time) / 1000,
    token = 'ago',
    list_choice = 1;

  if (seconds === 0) {
    return 'Just now'
  }
  if (seconds < 0) {
    seconds = Math.abs(seconds);
    token = 'from now';
    list_choice = 2;
  }
  let i = 0,
    format;
  while (format = time_formats[i++])
    if (seconds < format[0]) {
      if (typeof format[2] == 'string')
        return format[list_choice];
      else
        return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
    }
  return time;
}

async function getUserDetails() {
  const response = await fetch("./api-standard/user-details");
  return await response.json();
}

async function isInGroup(groupDID, did) {
  const openDSU = require("opendsu");
  let resolveDID = $$.promisify(openDSU.loadApi("w3cdid").resolveDID);
  let groupDIDDocument = await resolveDID(groupDID);
  let groupMembers = await $$.promisify(groupDIDDocument.listMembersByIdentity, groupDIDDocument)();

  for (let member of groupMembers) {
    if (member === did) {
      return true;
    }
  }
  return false
}

async function getUserRights() {
  let userRights;
  const openDSU = require("opendsu");
  const scAPI = openDSU.loadAPI("sc");
  const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
  let credential = await $$.promisify(mainEnclave.readKey)(constants.CREDENTIAL_KEY);

  if (credential.allPossibleGroups) {
    const did = await $$.promisify(mainEnclave.readKey)(constants.IDENTITY_KEY);
    for (let group of credential.allPossibleGroups) {
      if (await isInGroup(group.did, did)) {
        switch (group.accessMode) {
          case "read":
            userRights = constants.USER_RIGHTS.READ;
            break;
          case "write":
            userRights = constants.USER_RIGHTS.WRITE;
            break;
        }
        break;
      }
    }
  }


  if (!userRights) {
    //todo: add new constant in opendsu.containts for root-cause security
    throw createOpenDSUErrorWrapper("Unable to get user rights!", new Error("User is not present in any group."), "security");
  }

  return userRights;
}

function generateRandom(n) {
  let add = 1,
    max = 12 - add;

  if (n > max) {
    return generateRandom(max) + generateRandom(n - max);
  }

  max = Math.pow(10, n + add);
  let min = max / 10; // Math.pow(10, n) basically
  let number = Math.floor(Math.random() * (max - min + 1)) + min;

  return ("" + number).substring(add);
}

async function initMessage(msgType) {
  let userDetails = await getUserDetails();
  const config = require("opendsu").loadAPI("config");
  const epiProtocol = await $$.promisify(config.getEnv)("epiProtocolVersion");
  let senderId = userDetails && userDetails.username ? userDetails.username : "";
  return {
    messageType: msgType,
    messageTypeVersion: epiProtocol,
    senderId: senderId,
    receiverId: "",
    messageId: generateRandom(13),
    messageDateTime: new Date().toISOString(),
    token: ""
  }
}

async function ensureMinimalInfoOnMessage(message) {
  let userDetails = await getUserDetails();
  let senderId = userDetails && userDetails.username ? userDetails.username : null;
  if (senderId) {
    message.senderId = senderId;
  }
  return message;
}

//disable functionalities as it was defined in environment config
function disableFeatures(thisObj) {
  thisObj.model.disabledFeatures.forEach(offFuncKey => {
    let htmlNodes = thisObj.querySelectorAll(`.featureCode-${offFuncKey}`);
    htmlNodes.forEach(item => {
      item.setAttribute("disabled", "");
      item.classList.add("disabled-container");
      let childNodes = item.getElementsByTagName('*');
      for (let node of childNodes) {
        node.setAttribute("disabled", "");
      }
    })

  })
}

async function getLogDetails(recordData) {
  if (recordData.auditKeySSI) {
    const openDSU = require("opendsu");
    const resolver = openDSU.loadApi("resolver");
    let auditDSU = await $$.promisify(resolver.loadDSU)(recordData.auditKeySSI);
    let auditDetails = await $$.promisify(auditDSU.readFile)("/audit.json");
    return JSON.parse(auditDetails);
  } else {
    return recordData
  }
}

function renderToast(message, type, timeoutValue = 15000) {
  let toastContainer = document.querySelector(".toast-container");
  let toastElement = document.createElement("div");
  toastElement.classList.add("toast");
  toastElement.classList.add(type);
  toastElement.innerHTML = `<p class="toast-text">${message}</p>`
  let toastButton = document.createElement("div");
  toastButton.classList.add("toast-close-button");
  toastButton.innerHTML = `<svg width="14" height="15" viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M13.705 2.20934C13.8928 2.02156 13.9983 1.76687 13.9983 1.50131C13.9983 1.23575 13.8928 0.981059 13.705 0.793278C13.5172 0.605495 13.2625 0.5 12.997 0.5C12.7314 0.5 12.4767 0.605495 12.2889 0.793278L7 6.08352L1.70944 0.794943C1.52165 0.607161 1.26695 0.501666 1.00137 0.501666C0.735788 0.501666 0.481087 0.607161 0.293294 0.794943C0.105501 0.982724 2.79833e-09 1.23741 0 1.50297C-2.79833e-09 1.76854 0.105501 2.02322 0.293294 2.21101L5.58385 7.49958L0.29496 12.7898C0.107167 12.9776 0.00166609 13.2323 0.00166609 13.4979C0.0016661 13.7634 0.107167 14.0181 0.29496 14.2059C0.482752 14.3937 0.737454 14.4992 1.00303 14.4992C1.26861 14.4992 1.52331 14.3937 1.71111 14.2059L7 8.91565L12.2906 14.2067C12.4784 14.3945 12.7331 14.5 12.9986 14.5C13.2642 14.5 13.5189 14.3945 13.7067 14.2067C13.8945 14.0189 14 13.7643 14 13.4987C14 13.2331 13.8945 12.9784 13.7067 12.7907L8.41615 7.49958L13.705 2.20934Z" fill="black"/>
</svg>`
  toastButton.addEventListener(constants.HTML_EVENTS.CLICK, (evt) => {
    if (toastElement && toastElement.parentElement) {
      toastElement.parentNode.removeChild(toastElement);
    }
  })
  toastElement.appendChild(toastButton);
  setTimeout(() => {
    if (toastElement && toastElement.parentElement) {
      toastElement.parentNode.removeChild(toastElement);
    }
  }, timeoutValue)
  toastContainer.appendChild(toastElement);
}

function overrideConsoleError() {
  let originalErrorHandler = console.error;
  console.error = function (mainArg, ...args) {
    const openDSU = require("opendsu");
    let errHandler = openDSU.loadAPI("error");
    originalErrorHandler.call(console, mainArg, ...args);
    errHandler.reportUserRelevantError("Uncaught error", mainArg);
  }
}

function displayLoader() {
  if (!window.WebCardinal.loader.hidden) {
    //ignore other view calls until not finished last one;
    return;
  }
  window.WebCardinal.loader.hidden = false;
}

function hideLoader() {
  window.WebCardinal.loader.hidden = true;
}

function getPropertyDiffViewObj(diff, property, modelLabelsMap) {
  let oldValue = diff.oldValue;
  let newValue = diff.newValue;
  if (typeof oldValue !== "string") {
    oldValue = JSON.stringify(oldValue);
  }
  if (typeof newValue !== "string") {
    newValue = JSON.stringify(newValue);
  }
  return {
    "changedProperty": modelLabelsMap[property],
    "oldValue": {"value": oldValue || " ", "directDisplay": true},
    "newValue": {"value": newValue || " ", "directDisplay": true}
  }
}

function getEpiDiffViewObj(epiDiffObj) {
  let changedProperty = epiDiffObj.newValue ? `${epiDiffObj.newValue.language.label}  ${epiDiffObj.newValue.type.label}` : `${epiDiffObj.oldValue.language.label}  ${epiDiffObj.oldValue.type.label}`
  return {
    "changedProperty": changedProperty,
    "oldValue": {"value": epiDiffObj.oldValue || "-", "directDisplay": !!!epiDiffObj.oldValue},
    "newValue": {
      "value": epiDiffObj.newValue && epiDiffObj.newValue.action !== "delete" ? epiDiffObj.newValue : "-",
      "directDisplay": !!!epiDiffObj.newValue || epiDiffObj.newValue.action === "delete"
    },
    "dataType": "epi"
  }
}


function getPhotoDiffViewObj(diff, property, modelLabelsMap) {
  const gtinResolverUtils = require("gtin-resolver").getMappingsUtils();
  return {
    "changedProperty": modelLabelsMap[property],
    "oldValue": {
      "value": diff.oldValue ? gtinResolverUtils.getImageAsBase64(diff.oldValue) : " ",
      "directDisplay": true
    },
    "newValue": {
      "value": diff.newValue ? gtinResolverUtils.getImageAsBase64(diff.newValue) : " ",
      "directDisplay": true
    },
    "isPhoto": true
  }
}

function getDateDiffViewObj(diff, property, enableDaySelection, modelLabelsMap) {
  return {
    "changedProperty": modelLabelsMap[property],
    "oldValue": {
      "isDate": !!diff.oldValue,
      "value": diff.oldValue || false,
      "directDisplay": true,
      "enableExpiryDay": enableDaySelection.oldValue
    },
    "newValue": {
      "isDate": !!diff.newValue,
      "value": diff.newValue || false,
      "directDisplay": true,
      "enableExpiryDay": enableDaySelection.newValue
    }
  }
}

function showTextLoader() {
  if (document.querySelector("stencil-route:not([style='display: none;'])")) {
    document.querySelector("stencil-route:not([style='display: none;'])").classList.add("hidden");
  }
  window.WebCardinal.loader.hidden = false;
  window.WebCardinal.loader.classList.add("text-below");
}

function hideTextLoader() {
  window.WebCardinal.loader.hidden = true;
  window.WebCardinal.loader.classList.remove("text-below");
  document.querySelector("stencil-route:not([style='display: none;'])").classList.remove("hidden");
}

export default {
  convertDateFromISOToGS1Format,
  convertDateToShortISO,
  convertDateToGS1Format,
  convertDateTOGMTFormat,
  getIgnoreDayDate,
  getFetchUrl,
  fetch: executeFetch,
  sortByProperty,
  bytesToBase64,
  sanitizeCode,
  timeAgo,
  getUserDetails,
  generateRandom,
  initMessage,
  disableFeatures,
  getUserRights,
  ensureMinimalInfoOnMessage,
  getLogDetails,
  renderToast,
  overrideConsoleError,
  displayLoader,
  hideLoader,
  getPropertyDiffViewObj,
  getEpiDiffViewObj,
  getPhotoDiffViewObj,
  getDateDiffViewObj,
  showTextLoader,
  hideTextLoader
}
