/**
 * Utilities for converting Noir public inputs to contract-compatible byte arrays
 */

import { hexToDecimal, extract32Bytes } from "./crypto";

/**
 * Convert a hex string (field element) to a 32-byte array (big-endian)
 * All inputs from Noir are in hexadecimal format
 * @param hexString - Hex string (with or without '0x' prefix)
 * @returns 32-byte Uint8Array
 */
function hexToBytes32(hexString: string): Uint8Array {
  // Remove '0x' prefix if present
  const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  
  // Convert hex string to BigInt
  const bigIntValue = BigInt('0x' + cleanHex);
  
  // Convert to 32-byte array (big-endian)
  const bytes = new Uint8Array(32);
  let value = bigIntValue;
  const mask = BigInt(0xff);
  const shift = BigInt(8);
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(value & mask);
    value = value >> shift;
  }
  return bytes;
}


/**
 * Convert Noir deposit/withdraw public inputs to Uint8Array(416) matching contract layout
 * 
 * Contract expects public inputs in this order:
 * [0..64]:     sender_pubkey (x: 32, y: 32)
 * [64..192]:   old_balance_ct (x1.x: 32, x1.y: 32, x2.x: 32, x2.y: 32)
 * [192..224]:  sender_address (32)
 * [224..256]:  token (32)
 * [256..288]:  revealed_amount (32) - OUTPUT
 * [288..416]:  new_balance_ct (x1.x: 32, x1.y: 32, x2.x: 32, x2.y: 32) - OUTPUT
 * 
 * Noir publicInputs array typically contains:
 * First: all public input parameters in order
 * Then: all public return values
 * So the order is: [sender_pubkey.x, sender_pubkey.y,
 *                   old_balance_x1.x, old_balance_x1.y, old_balance_x2.x, old_balance_x2.y,
 *                   sender_address, token, amount,
 *                   new_balance_x1.x, new_balance_x1.y, new_balance_x2.x, new_balance_x2.y]
 * 
 * This function reorders them to match the contract layout.
 * 
 * @param publicInputs - Array of public inputs from Noir proof (all in hex format)
 * @returns Uint8Array of exactly 416 bytes
 */
export function convertDepositPublicInputs(publicInputs: string[]): Uint8Array {
  if (publicInputs.length < 13) {
    throw new Error(`Expected at least 13 public inputs, got ${publicInputs.length}`);
  }

  const publicInputsArray = new Uint8Array(416);
  let offset = 0;

  // sender_pubkey.x (32 bytes) - index 0
  publicInputsArray.set(hexToBytes32(publicInputs[0]), offset);
  offset += 32;

  // sender_pubkey.y (32 bytes) - index 1
  publicInputsArray.set(hexToBytes32(publicInputs[1]), offset);
  offset += 32;

  // old_balance_x1.x (32 bytes) - index 2
  publicInputsArray.set(hexToBytes32(publicInputs[2]), offset);
  offset += 32;

  // old_balance_x1.y (32 bytes) - index 3
  publicInputsArray.set(hexToBytes32(publicInputs[3]), offset);
  offset += 32;

  // old_balance_x2.x (32 bytes) - index 4
  publicInputsArray.set(hexToBytes32(publicInputs[4]), offset);
  offset += 32;

  // old_balance_x2.y (32 bytes) - index 5
  publicInputsArray.set(hexToBytes32(publicInputs[5]), offset);
  offset += 32;

  // sender_address (32 bytes) - index 6 (already padded hex)
  publicInputsArray.set(hexToBytes32(publicInputs[6]), offset);
  offset += 32;

  // token (32 bytes) - index 7 (already padded hex)
  publicInputsArray.set(hexToBytes32(publicInputs[7]), offset);
  offset += 32;

  // revealed_amount (32 bytes) - index 8
  publicInputsArray.set(hexToBytes32(publicInputs[8]), offset);
  offset += 32;

  // new_balance_x1.x (32 bytes) - index 9
  publicInputsArray.set(hexToBytes32(publicInputs[9]), offset);
  offset += 32;

  // new_balance_x1.y (32 bytes) - index 10
  publicInputsArray.set(hexToBytes32(publicInputs[10]), offset);
  offset += 32;

  // new_balance_x2.x (32 bytes) - index 11
  publicInputsArray.set(hexToBytes32(publicInputs[11]), offset);
  offset += 32;

  // new_balance_x2.y (32 bytes) - index 12
  publicInputsArray.set(hexToBytes32(publicInputs[12]), offset);
  offset += 32;

  return publicInputsArray;
}

/**
 * Convert Noir transfer public inputs to Uint8Array(704) matching contract layout
 * 
 * Contract expects public inputs in this order (based on _decode_transfer_confidential_proof_inputs):
 * [12..32]:    receiver_address (20 bytes, stored at offset 12, so [0..12] is padding)
 * [32..96]:    receiver_pubkey (x: 32, y: 32)
 * [96..224]:   receiver_current_balance (x1.x: 32, x1.y: 32, x2.x: 32, x2.y: 32)
 * [224..288]:  sender_pubkey (x: 32, y: 32)
 * [288..416]:  sender_current_balance (x1.x: 32, x1.y: 32, x2.x: 32, x2.y: 32)
 * [428..448]:  token (20 bytes, stored at offset 428, so [416..428] is padding)
 * [448..576]:  sender_new_balance (x1.x: 32, x1.y: 32, x2.x: 32, x2.y: 32) - OUTPUT
 * [576..704]:  receiver_new_balance (x1.x: 32, x1.y: 32, x2.x: 32, x2.y: 32) - OUTPUT
 * Total: 704 bytes
 * 
 * Noir publicInputs array order (from proof generation):
 * [0]: receiver_address
 * [1-2]: receiver_pubkey.x, receiver_pubkey.y
 * [3-6]: receiver_old_balance_x1.x, receiver_old_balance_x1.y, receiver_old_balance_x2.x, receiver_old_balance_x2.y
 * [7-8]: sender_pubkey.x, sender_pubkey.y
 * [9-12]: sender_old_balance_x1.x, sender_old_balance_x1.y, sender_old_balance_x2.x, sender_old_balance_x2.y
 * [13]: token
 * [14-17]: sender_new_x1.x, sender_new_x1.y, sender_new_x2.x, sender_new_x2.y (outputs)
 * [18-21]: receiver_new_x1.x, receiver_new_x1.y, receiver_new_x2.x, receiver_new_x2.y (outputs)
 * 
 * @param publicInputs - Array of public inputs from Noir proof (all in hex format)
 * @returns Uint8Array of exactly 704 bytes
 */
export function convertTransferPublicInputs(publicInputs: string[]): Uint8Array {
  if (publicInputs.length < 22) {
    throw new Error(`Expected at least 22 public inputs, got ${publicInputs.length}`);
  }

  const publicInputsArray = new Uint8Array(704);
  
  // receiver_address (20 bytes at offset 12, so we pad first 12 bytes with zeros)
  const receiverAddrBytes = hexToBytes32(publicInputs[0]);
  publicInputsArray.set(receiverAddrBytes.slice(12, 32), 12); // Take last 20 bytes

  // receiver_pubkey (64 bytes at offset 32)
  publicInputsArray.set(hexToBytes32(publicInputs[1]), 32); // x
  publicInputsArray.set(hexToBytes32(publicInputs[2]), 64); // y

  // receiver_current_balance (128 bytes at offset 96)
  publicInputsArray.set(hexToBytes32(publicInputs[3]), 96);  // x1.x
  publicInputsArray.set(hexToBytes32(publicInputs[4]), 128);  // x1.y
  publicInputsArray.set(hexToBytes32(publicInputs[5]), 160); // x2.x
  publicInputsArray.set(hexToBytes32(publicInputs[6]), 192); // x2.y

  // sender_pubkey (64 bytes at offset 224)
  publicInputsArray.set(hexToBytes32(publicInputs[7]), 224); // x
  publicInputsArray.set(hexToBytes32(publicInputs[8]), 256); // y

  // sender_current_balance (128 bytes at offset 288)
  publicInputsArray.set(hexToBytes32(publicInputs[9]), 288);  // x1.x
  publicInputsArray.set(hexToBytes32(publicInputs[10]), 320); // x1.y
  publicInputsArray.set(hexToBytes32(publicInputs[11]), 352); // x2.x
  publicInputsArray.set(hexToBytes32(publicInputs[12]), 384); // x2.y

  // token (20 bytes at offset 428, so we pad [416..428] with zeros)
  const tokenBytes = hexToBytes32(publicInputs[13]);
  publicInputsArray.set(tokenBytes.slice(12, 32), 428); // Take last 20 bytes

  // sender_new_balance (128 bytes at offset 448) - OUTPUTS
  publicInputsArray.set(hexToBytes32(publicInputs[14]), 448); // x1.x
  publicInputsArray.set(hexToBytes32(publicInputs[15]), 480); // x1.y
  publicInputsArray.set(hexToBytes32(publicInputs[16]), 512); // x2.x
  publicInputsArray.set(hexToBytes32(publicInputs[17]), 544); // x2.y

  // receiver_new_balance (128 bytes at offset 576) - OUTPUTS
  publicInputsArray.set(hexToBytes32(publicInputs[18]), 576); // x1.x
  publicInputsArray.set(hexToBytes32(publicInputs[19]), 608); // x1.y
  publicInputsArray.set(hexToBytes32(publicInputs[20]), 640); // x2.x
  publicInputsArray.set(hexToBytes32(publicInputs[21]), 672); // x2.y

  return publicInputsArray;
}

export function parseUserBalance(currentBalance: Uint8Array) {
  const currentBalanceBytes = currentBalance instanceof Uint8Array 
    ? currentBalance 
    : new Uint8Array(currentBalance);

  // Parse balance into two points
  // oldBalanceX1: x = [0..32], y = [32..64]
  // oldBalanceX2: x = [64..96], y = [96..128]
  // Convert hex strings to decimal strings for Noir Field elements
  const oldBalanceX1 = {
    x: hexToDecimal(extract32Bytes(currentBalanceBytes, 0)),
    y: hexToDecimal(extract32Bytes(currentBalanceBytes, 32)),
  };
  const oldBalanceX2 = {
    x: hexToDecimal(extract32Bytes(currentBalanceBytes, 64)),
    y: hexToDecimal(extract32Bytes(currentBalanceBytes, 96)),
  };

  return {
    oldBalanceX1,
    oldBalanceX2,
  };
}