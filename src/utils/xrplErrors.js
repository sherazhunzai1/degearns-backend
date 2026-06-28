/**
 * XRPL Error Translation
 *
 * Converts raw XRP Ledger result codes (tecPATH_DRY, tecUNFUNDED_PAYMENT, ...),
 * RPC errors (actNotFound, txnNotFound, ...) and xrpl.js client errors
 * (NotConnectedError, TimeoutError, ...) into short, plain-language messages
 * that are safe to show end users, wrapped in an ApiError with a sensible HTTP
 * status code.
 *
 * Usage:
 *   const { ensureTxSuccess, translateXrplError, isXrplError } = require('../utils/xrplErrors');
 *
 *   // After submitting a transaction server-side:
 *   ensureTxSuccess(result, 'mint the NFT');   // throws a friendly ApiError if it failed
 *
 *   // When verifying a signed transaction's result code:
 *   if (code !== 'tesSUCCESS') throw translateXrplError(code, { action: 'set the trust line' });
 *
 *   // Global safety net (error handler middleware):
 *   if (isXrplError(err)) error = translateXrplError(err);
 */

const ApiError = require('./ApiError');
const logger = require('./logger');

// Matches XRPL engine result codes: tesSUCCESS, tec*, tem*, ter*, tef*, tel*
const CODE_REGEX = /\b(tes[A-Z][A-Za-z_]+|te[cfmlr][A-Z][A-Za-z_]+)\b/;

// xrpl.js error class names that indicate a ledger/connectivity problem
const NAME_TO_CODE = {
  NotConnectedError: 'CONNECTION',
  DisconnectedError: 'CONNECTION',
  ConnectionError: 'CONNECTION',
  RippledNotInitializedError: 'CONNECTION',
  TimeoutError: 'TIMEOUT',
  ResponseFormatError: 'LEDGER_ERROR',
  UnexpectedError: 'LEDGER_ERROR',
  ValidationError: 'temMALFORMED'
};

// RPC/client error strings returned in error.data.error
const RPC_CODES = {
  actNotFound: { message: "This account doesn't exist or hasn't been activated on the XRP Ledger yet.", statusCode: 404 },
  accountNotFound: { message: "This account doesn't exist or hasn't been activated on the XRP Ledger yet.", statusCode: 404 },
  actMalformed: { message: 'The account address is invalid.', statusCode: 400 },
  actBitcoin: { message: 'The account address is invalid.', statusCode: 400 },
  txnNotFound: { message: "The transaction couldn't be found on the ledger yet. It may still be processing — please try again in a moment.", statusCode: 404 },
  entryNotFound: { message: "The requested item couldn't be found on the ledger.", statusCode: 404 },
  objectNotFound: { message: "The requested item couldn't be found on the ledger.", statusCode: 404 },
  lgrNotFound: { message: 'The requested ledger could not be found.', statusCode: 404 },
  invalidParams: { message: 'The request is missing required information.', statusCode: 400 },
  invalidTransaction: { message: 'The transaction is invalid.', statusCode: 400 },
  invalid_params: { message: 'The request is missing required information.', statusCode: 400 },
  unknownCmd: { message: 'Unsupported ledger command.', statusCode: 400 },
  noNetwork: { message: 'The XRP Ledger is temporarily unreachable. Please try again shortly.', statusCode: 503 },
  noCurrent: { message: 'The XRP Ledger is still syncing. Please try again shortly.', statusCode: 503 },
  noClosed: { message: 'The XRP Ledger is still syncing. Please try again shortly.', statusCode: 503 },
  tooBusy: { message: 'The XRP Ledger is busy right now. Please try again shortly.', statusCode: 503 },
  amendmentBlocked: { message: 'The XRP Ledger requires a software upgrade. Please contact support.', statusCode: 503 },
  noPermission: { message: "You don't have permission to perform this action.", statusCode: 403 },
  internal: { message: 'An internal ledger error occurred. Please try again.', statusCode: 502 },
  // synthetic (from xrpl.js client error class names)
  CONNECTION: { message: "Couldn't reach the XRP Ledger right now. Please try again shortly.", statusCode: 503 },
  TIMEOUT: { message: 'The XRP Ledger took too long to respond. Please try again.', statusCode: 504 },
  LEDGER_ERROR: { message: 'An unexpected error occurred while talking to the XRP Ledger. Please try again.', statusCode: 502 }
};

// Engine result codes (tec/tem/ter/tef/tel) → friendly message + HTTP status
const XRPL_ERROR_MAP = {
  // ---- tec: transaction failed, fee was still claimed (most user-facing) ----
  tecUNFUNDED: { message: "You don't have enough XRP to complete this transaction.", statusCode: 400 },
  tecUNFUNDED_PAYMENT: { message: 'Insufficient balance to send this payment.', statusCode: 400 },
  tecUNFUNDED_OFFER: { message: 'Insufficient balance to place this order.', statusCode: 400 },
  tecUNFUNDED_AMM: { message: 'Insufficient balance to fund the liquidity pool.', statusCode: 400 },
  tecINSUFFICIENT_FUNDS: { message: 'Insufficient funds to complete this transaction.', statusCode: 400 },
  tecINSUFFICIENT_PAYMENT: { message: 'The payment amount is too small to be processed.', statusCode: 400 },
  tecINSUFF_FEE: { message: 'Not enough XRP to pay the network fee.', statusCode: 400 },
  tecINSUFFICIENT_RESERVE: { message: 'You need more XRP to meet the account reserve requirement.', statusCode: 400 },
  tecINSUF_RESERVE_LINE: { message: 'You need more XRP in reserve to add this trust line.', statusCode: 400 },
  tecINSUF_RESERVE_OFFER: { message: 'You need more XRP in reserve to place this order.', statusCode: 400 },
  tecNO_DST: { message: "The destination account doesn't exist yet.", statusCode: 400 },
  tecNO_DST_INSUF_XRP: { message: 'The destination account must be funded with more XRP before it can receive this.', statusCode: 400 },
  tecDST_TAG_NEEDED: { message: 'This destination requires a destination tag.', statusCode: 400 },
  tecNO_PERMISSION: { message: "You don't have permission to perform this action.", statusCode: 403 },
  tecNO_LINE: { message: 'A trust line for this token is required before you can hold it.', statusCode: 400 },
  tecNO_LINE_INSUF_RESERVE: { message: 'You need more XRP in reserve to set up this trust line.', statusCode: 400 },
  tecNO_LINE_REDUNDANT: { message: 'This trust line is already set the way you requested.', statusCode: 400 },
  tecNO_AUTH: { message: "You're not authorized to hold this token.", statusCode: 400 },
  tecNO_ISSUER: { message: "The token issuer doesn't exist.", statusCode: 400 },
  tecNO_TARGET: { message: "The target of this transaction doesn't exist.", statusCode: 404 },
  tecNO_ENTRY: { message: 'The requested ledger item could not be found.', statusCode: 404 },
  tecOBJECT_NOT_FOUND: { message: "The requested item couldn't be found on the ledger.", statusCode: 404 },
  tecPATH_DRY: { message: "There isn't enough liquidity to complete this trade right now.", statusCode: 400 },
  tecPATH_PARTIAL: { message: "The trade couldn't be completed at the requested price. Try increasing your slippage tolerance.", statusCode: 400 },
  tecKILLED: { message: "The order was canceled because it couldn't be filled immediately.", statusCode: 400 },
  tecEXPIRED: { message: 'This transaction has expired. Please try again.', statusCode: 400 },
  tecFROZEN: { message: "This token is frozen and can't be transferred right now.", statusCode: 400 },
  tecFAILED_PROCESSING: { message: 'The transaction could not be processed. Please try again.', statusCode: 400 },
  tecDIR_FULL: { message: 'This account holds too many items to add another.', statusCode: 400 },
  tecOWNERS: { message: 'This account has too many items; remove some and try again.', statusCode: 400 },
  tecDUPLICATE: { message: 'This item already exists on the ledger.', statusCode: 409 },
  tecOVERSIZE: { message: 'The transaction is too large to process.', statusCode: 400 },
  tecTOO_SOON: { message: "It's too soon to perform this action. Please wait and try again.", statusCode: 400 },
  tecINTERNAL: { message: 'An internal ledger error occurred. Please try again.', statusCode: 502 },
  tecCLAIM: { message: 'The transaction failed, but the network fee was still charged. Please try again.', statusCode: 400 },
  tecCRYPTOCONDITION_ERROR: { message: 'The transaction condition could not be met.', statusCode: 400 },
  // AMM (liquidity pool) specific
  tecAMM_BALANCE: { message: "The liquidity pool doesn't have enough balance for this operation.", statusCode: 400 },
  tecAMM_EMPTY: { message: 'This liquidity pool is empty.', statusCode: 400 },
  tecAMM_NOT_EMPTY: { message: 'This liquidity pool still holds funds.', statusCode: 400 },
  tecAMM_FAILED: { message: 'The liquidity pool operation failed. Please check the amounts and try again.', statusCode: 400 },
  tecAMM_INVALID_TOKENS: { message: 'The token amounts for this liquidity pool are invalid.', statusCode: 400 },
  tecAMM_ACCOUNT: { message: 'Invalid liquidity pool account.', statusCode: 400 },
  // NFT specific
  tecNO_SUITABLE_NFTOKEN_PAGE: { message: 'Could not store the NFT. Please try again.', statusCode: 400 },
  tecNFTOKEN_BUY_SELL_MISMATCH: { message: "The buy and sell offers don't match.", statusCode: 400 },
  tecNFTOKEN_OFFER_TYPE_MISMATCH: { message: 'Invalid NFT offer type.', statusCode: 400 },
  tecMAX_SEQUENCE_REACHED: { message: 'This collection has reached its maximum size.', statusCode: 400 },
  tecINSUFFICIENT_RESERVE_NFT: { message: 'You need more XRP in reserve to hold this NFT.', statusCode: 400 },

  // ---- tem: malformed transaction (bad input) ----
  temMALFORMED: { message: 'The transaction details are invalid.', statusCode: 400 },
  temBAD_AMOUNT: { message: 'The amount specified is invalid.', statusCode: 400 },
  temBAD_CURRENCY: { message: 'The currency code is invalid.', statusCode: 400 },
  temBAD_FEE: { message: 'The network fee specified is invalid.', statusCode: 400 },
  temBAD_ISSUER: { message: 'The token issuer is invalid.', statusCode: 400 },
  temBAD_LIMIT: { message: 'The trust line limit is invalid.', statusCode: 400 },
  temBAD_OFFER: { message: 'The order details are invalid.', statusCode: 400 },
  temBAD_PATH: { message: 'No valid path was found for this payment.', statusCode: 400 },
  temBAD_PATH_LOOP: { message: 'The payment path is invalid.', statusCode: 400 },
  temBAD_SEND_MAX: { message: 'The maximum send amount is invalid.', statusCode: 400 },
  temBAD_SEQUENCE: { message: 'The transaction sequence is invalid.', statusCode: 400 },
  temBAD_SIGNATURE: { message: 'The transaction signature is invalid.', statusCode: 400 },
  temBAD_AUTH_MASTER: { message: "The signing key isn't authorized for this account.", statusCode: 400 },
  temREDUNDANT: { message: 'This transaction would have no effect.', statusCode: 400 },
  temDISABLED: { message: "This feature isn't currently enabled on the network.", statusCode: 400 },
  temINVALID: { message: 'The transaction is invalid.', statusCode: 400 },
  temINVALID_FLAG: { message: 'An invalid flag was set on the transaction.', statusCode: 400 },
  temBAD_AMM_TOKENS: { message: 'The liquidity pool token amounts are invalid.', statusCode: 400 },

  // ---- ter: could not apply yet (retry) ----
  terNO_ACCOUNT: { message: "The account doesn't exist or isn't funded yet.", statusCode: 400 },
  terNO_LINE: { message: 'A trust line is required first.', statusCode: 400 },
  terNO_AUTH: { message: "Authorization for this token hasn't been set up yet.", statusCode: 400 },
  terNO_AMM: { message: "No liquidity pool exists for this token pair yet.", statusCode: 400 },
  terPRE_SEQ: { message: 'This transaction is waiting on a previous one. Please try again shortly.', statusCode: 409 },
  terPRE_TICKET: { message: 'This transaction is waiting on a ticket. Please try again shortly.', statusCode: 409 },
  terRETRY: { message: "The transaction couldn't be applied yet. Please try again.", statusCode: 409 },
  terQUEUED: { message: 'The transaction has been queued. Please wait a moment.', statusCode: 409 },
  terINSUF_FEE_B: { message: 'Not enough XRP to pay the network fee.', statusCode: 400 },
  terOWNERS: { message: 'This account has too many items; remove some and try again.', statusCode: 400 },

  // ---- tef: failed permanently ----
  tefALREADY: { message: 'This transaction was already submitted.', statusCode: 409 },
  tefPAST_SEQ: { message: 'This transaction has already been processed or expired. Please try again.', statusCode: 409 },
  tefMAX_LEDGER: { message: 'The transaction expired before it was confirmed. Please try again.', statusCode: 400 },
  tefBAD_AUTH: { message: 'Authorization failed for this transaction.', statusCode: 400 },
  tefBAD_AUTH_MASTER: { message: "The signing key isn't authorized for this account.", statusCode: 400 },
  tefMASTER_DISABLED: { message: "The account's master key is disabled.", statusCode: 400 },
  tefNO_AUTH_REQUIRED: { message: "Authorization isn't required for this token.", statusCode: 400 },
  tefWRONG_PRIOR: { message: "The transaction couldn't be applied. Please try again.", statusCode: 409 },
  tefINVARIANT_FAILED: { message: 'The transaction failed a ledger safety check.', statusCode: 502 },
  tefEXCEPTION: { message: 'A ledger error occurred. Please try again.', statusCode: 502 },
  tefINTERNAL: { message: 'A ledger error occurred. Please try again.', statusCode: 502 },

  // ---- tel: local node error ----
  telINSUF_FEE_P: { message: 'The network fee is too low right now. Please try again.', statusCode: 400 },
  telLOCAL_ERROR: { message: "The network couldn't process the transaction right now. Please try again shortly.", statusCode: 503 },
  telCAN_NOT_QUEUE: { message: 'The network is busy and could not queue the transaction. Please try again shortly.', statusCode: 503 },
  telCAN_NOT_QUEUE_BALANCE: { message: 'The network is busy. Please try again shortly.', statusCode: 503 },
  telCAN_NOT_QUEUE_FEE: { message: 'The network fee is too low to queue right now. Please try again.', statusCode: 503 },
  telCAN_NOT_QUEUE_FULL: { message: 'The network transaction queue is full. Please try again shortly.', statusCode: 503 }
};

// Fallback message + status by code prefix, for codes not explicitly mapped above
const PREFIX_DEFAULTS = {
  tec: { message: 'The transaction could not be completed on the XRP Ledger.', statusCode: 400 },
  tem: { message: 'The transaction details are invalid.', statusCode: 400 },
  ter: { message: "The transaction couldn't be processed yet. Please try again shortly.", statusCode: 409 },
  tef: { message: 'The transaction failed and could not be applied. It may have expired — please try again.', statusCode: 400 },
  tel: { message: 'The network could not process the transaction right now. Please try again shortly.', statusCode: 503 }
};

const GENERIC = { message: 'The XRP Ledger transaction could not be completed. Please try again.', statusCode: 400 };

/**
 * Extract an XRPL result/RPC/connection code from any input:
 * a code string, a submitAndWait result, a `tx` response, or an Error/RippledError.
 * @returns {string|null}
 */
function getXrplResultCode(input) {
  if (!input) return null;

  if (typeof input === 'string') {
    if (RPC_CODES[input] || XRPL_ERROR_MAP[input]) return input;
    const m = input.match(CODE_REGEX);
    return m ? m[1] : null;
  }

  // Transaction result object: { result: { meta, engine_result } } or the inner result itself
  const res = input.result || input;
  if (res && typeof res === 'object') {
    const meta = res.meta || res.metaData;
    if (meta && meta.TransactionResult) return meta.TransactionResult;
    if (res.engine_result) return res.engine_result;
  }

  // RippledError style: error.data.error
  if (input.data && typeof input.data.error === 'string') return input.data.error;

  // Scan the error message for a known code
  if (typeof input.message === 'string') {
    const m = input.message.match(CODE_REGEX);
    if (m) return m[1];
    for (const code of Object.keys(RPC_CODES)) {
      if (code.length > 4 && input.message.includes(code)) return code;
    }
  }

  // xrpl.js client error class name → synthetic code
  if (input.name && NAME_TO_CODE[input.name]) return NAME_TO_CODE[input.name];

  return null;
}

/**
 * Describe a code → { code, message, statusCode } or null if unrecognized.
 */
function describeXrplCode(code) {
  if (!code) return null;
  if (code === 'tesSUCCESS') return { code, message: 'Transaction succeeded.', statusCode: 200 };
  if (XRPL_ERROR_MAP[code]) return { code, ...XRPL_ERROR_MAP[code] };
  if (RPC_CODES[code]) return { code, ...RPC_CODES[code] };
  const prefix = code.slice(0, 3);
  if (PREFIX_DEFAULTS[prefix]) return { code, ...PREFIX_DEFAULTS[prefix] };
  return null;
}

/**
 * Whether an error/result represents a recognizable XRPL failure.
 * Returns false for ApiError (already translated) and non-XRPL errors, so it's
 * safe to use as a guard in the global error handler.
 */
function isXrplError(input) {
  if (!input || input instanceof ApiError) return false;
  if (input.name && NAME_TO_CODE[input.name]) return true;
  const code = getXrplResultCode(input);
  if (!code) return false;
  return !!describeXrplCode(code);
}

/**
 * Translate any XRPL error/result/code into a user-friendly ApiError.
 * @param {*} input - code string, tx result, or Error
 * @param {{action?: string, statusCode?: number, fallbackMessage?: string}} [options]
 *   action: short verb phrase, e.g. 'mint the NFT' → "Couldn't mint the NFT. <reason>"
 * @returns {ApiError}
 */
function translateXrplError(input, options = {}) {
  if (input instanceof ApiError) return input;

  const code = getXrplResultCode(input);
  const described = describeXrplCode(code);
  const reason = described ? described.message : (options.fallbackMessage || GENERIC.message);
  const statusCode = options.statusCode || (described ? described.statusCode : GENERIC.statusCode);

  const message = options.action ? `Couldn't ${options.action}. ${reason}` : reason;

  if (code) {
    logger.warn(`XRPL error ${code}${options.action ? ` while trying to ${options.action}` : ''}`);
  }

  const apiError = new ApiError(statusCode, message);
  if (code) apiError.xrplCode = code;
  return apiError;
}

/**
 * Throw a friendly ApiError if a submitted transaction did not succeed.
 * @param {*} txResult - the submitAndWait result (or inner result / code)
 * @param {string} [action] - short verb phrase for context, e.g. 'send the payment'
 * @returns {string} the result code (tesSUCCESS) when successful
 */
function ensureTxSuccess(txResult, action) {
  const code = getXrplResultCode(txResult);
  if (code === 'tesSUCCESS') return code;
  throw translateXrplError(txResult, { action });
}

module.exports = {
  getXrplResultCode,
  describeXrplCode,
  isXrplError,
  translateXrplError,
  ensureTxSuccess,
  XRPL_ERROR_MAP,
  RPC_CODES
};
