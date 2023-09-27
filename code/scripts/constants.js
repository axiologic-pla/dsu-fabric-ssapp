export default {
  'PACKAGES_STORAGE_PATH': "/app/data/packages.json",
  'DATA_STORAGE_PATH': "/app/data",
  'PRODUCTS_TABLE': "products",
  'BLOCKCHAIN_SCANS_TABLE': "blockchain_scans",
  'LOGS_TABLE': "logs",
  'LOGIN_LOGS_TABLE': "login_logs",
  'SERIAL_NUMBERS_LOGS_TABLE': "serial_numbers_logs",
  'PRODUCT_KEYSSI_STORAGE_TABLE': "productKeySSIs",
  'BATCHES_STORAGE_TABLE': "batches",
  'PRODUCT_DSU_MOUNT_POINT': "/gtinDSU",
  'LEAFLET_ATTACHMENT_FILE': "/leaflet.xml",
  'SMPC_ATTACHMENT_FILE': "/smpc.xml",
  "ISSUER_FILE_PATH": "/myKeys/issuer.json",
  "WALLET_HOLDER_FILE_PATH": "/myKeys/holder.json",
  "WALLET_DID_PATH": "/myKeys/did",
  "WALLET_CREDENTIAL_FILE_PATH": "/myKeys/credential.json",
  "SSAPP_HOLDER_FILE_PATH": "/apps/dsu-fabric-ssapp/myKeys/holder.json",
  "SSAPP_CREDENTIAL_FILE_PATH": "/apps/dsu-fabric-ssapp/myKeys/credential.json",
  EPI_ADMIN_GROUP: "ePI_Administration_Group",
  EPI_WRITE_GROUP: "ePI_Write_Group",
  EPI_READ_GROUP: "ePI_Read_Group",
  'DID_GROUP_MAP': {
    'ePI_Read_Group': "ePI Read Group",
    'ePI_Write_Group': "ePI Write Group",
    'ePI_Administration_Group': "ePI Administration Group",
  },
  MESSAGE_TYPES: {
    USER_LOGIN: "userLogin",
    USER_REMOVED: "userRemoved",
    RECEIVED_APPROVAL: "receivedApproval",
    DID_CREATED: "didCreated",
    ADD_MEMBER_TO_GROUP: "AddMemberToGroup"
  },
  IDENTITY_KEY: "did",
  CREDENTIAL_KEY: "credential",
  CREDENTIAL_DELETED: "deleted",
  NOTIFICATION_TYPES: {
    WARN: "warn",
    INFO: "info",
    ERROR: "error"
  },
  HOOKS: {
    BEFORE_PAGE_LOADS: "beforePageLoads",
    WHEN_PAGE_CLOSE: "whenPageClose",
    BEFORE_APP_LOADS: "beforeAppLoads",
    AFTER_APP_LOADS: "afterAppLoads"
  },
  HTML_EVENTS: {
    CLOSED: "closed",
    CONFIRMED: "confirmed",
    SEARCH: "search",
    CLICK: "click",
    SLOTCHANGE: "slotchange",
    FOCUSOUT: "focusout",
    CHANGE: "change",
    UPLOADPRODUCTS: "uploadProducts"
  },
  BLOOMFILTER_SERIAL_TYPES: {
    VALID: "validSerialNumbers",
    RECALLED: "recalledSerialNumbers",
    DECOMMISSIONED: "decommissionedSerialNumbers"
  },
  USER_RIGHTS: {
    READ: "readonly",
    WRITE: "readwrite"
  },
  MODEL_LABELS_MAP: {
    PRODUCT: {
      gtin: "Product Code",
      name: "Brand/Invented name",
      description: "Name of Medicinal Product",
      internalMaterialCode: "Internal material code",
      strength: "Strength",
      photo: "Product Photo",
      patientLeafletInfo: "Patient Specific Information Leaflet",
      practitionerInfo: "Healthcare practitioner information",
      videoSource: "Video Source",
      adverseEventsReportingEnabled: "Enable Adverse Events Reporting",
      antiCounterfeitingEnabled: "Enable Anti-Counterfeiting check for this product",
      markets: "Markets management"
    },
    BATCH: {
      batchNumber: "Batch",
      packagingSiteName: "Packaging site name",
      expiryForDisplay: "Expiry date",
      enableExpiryDay: "Enable day selection",
      gtin: "Product Code",
      productName: "Product Brand/Invented name"
    }
  }
}
