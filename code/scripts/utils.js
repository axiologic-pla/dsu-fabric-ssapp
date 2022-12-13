import constants from "./constants.js";


function convertDateToISO(dateString) {
  const d = new Date(dateString);
  let isoDateString = d.toISOString();
  isoDateString = isoDateString.slice(0, 10);
  return isoDateString;
}

function convertDateFromISOToGS1Format(isoDateString, separator) {
  const date = new Date(isoDateString);
  const ye = new Intl.DateTimeFormat('en', {year: '2-digit'}).format(date);
  const mo = new Intl.DateTimeFormat('en', {month: '2-digit'}).format(date);
  const da = new Intl.DateTimeFormat('en', {day: '2-digit'}).format(date);
  if (separator) {
    return `${ye}${separator}${mo}${separator}${da}`
  }
  return `${ye}${mo}${da}`;
}

function convertDateToGS1Format(dateString, useDay) {
  let gs1Date = convertDateFromISOToGS1Format(convertDateToISO(dateString));
  if (!useDay) {
    gs1Date = gs1Date.slice(0, -2) + "00";
  }
  return gs1Date
}

function getIgnoreDayDate(dateString) {
  let dt = new Date(dateString);
  let y = dt.getFullYear();
  let m = ("0" + (dt.getMonth() + 1)).slice(-2);
  const d = ("0" + dt.getDate()).slice(-2);
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
  try {
    const response = await fetch("./api-standard/user-details");
    return await response.json();
  } catch (err) {
    console.error(`Failed to get user's details`, err);
    return {};
  }
}

async function getUserRights() {
  let userRights = "readonly";
  const openDSU = require("opendsu");
  const scAPI = openDSU.loadAPI("sc");
  try {
    const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
    let credential = await $$.promisify(mainEnclave.readKey)("credential");
    let userEpiGroup = credential.tags[0];
    if (userEpiGroup !== constants.DID_GROUP_MAP.ePI_Read_Group) {
      userRights = "readwrite"
    }
  } catch (e) {
    //if any error keep readonly rights for the user
    console.log("Could not get user rights", e);
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

//disable functionalities as it was defined in environment config
function disableFeatures(thisObj) {
  thisObj.model.disabledFeatures.forEach(offFuncKey => {
    let htmlNodes = thisObj.querySelectorAll(`.featureCode-${offFuncKey}`);
    htmlNodes.forEach(item => {
      item.disabled = true;
      item.classList.add("disabled-container");
      let childNodes = item.getElementsByTagName('*');
      for (let node of childNodes) {
        node.disabled = true;
      }
    })

  })
}
export default {
  convertDateFromISOToGS1Format,
  convertDateToISO,
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
  getUserRights
}
