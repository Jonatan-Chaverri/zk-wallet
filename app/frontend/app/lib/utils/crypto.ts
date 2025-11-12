// Crypto utilities for ElGamal encryption/decryption over BabyJub
// NOTE: This is a placeholder - actual implementation requires Noir circuits or WASM

import { GrumpkinScalar, Schnorr } from '@aztec/aztec.js';
import { Buffer } from 'buffer/';
import type { BabyJubKeyPair, Ciphertext } from '../types';

/**
 * Convert Fr (field element) to 32-byte hex string
 */
function frTo32BytesHex(fr: any): string {
  const buf = fr.toBuffer(); // usually 32 bytes
  if (buf.length !== 32) {
    throw new Error(`Fr.toBuffer() expected 32 bytes, got ${buf.length}`);
  }
  return `0x${Buffer.from(buf).toString('hex')}`;
}

/**
 * Generate a BabyJub key pair using Aztec.js (Grumpkin curve)
 * This matches the key generation used in the Noir circuits
 */
export async function generateBabyJubKeyPair(seed?: string): Promise<BabyJubKeyPair> {
  // Generate private key (GrumpkinScalar)
  const sk = seed 
    ? GrumpkinScalar.fromString(seed)
    : GrumpkinScalar.random();
  
  // Compute public key using Schnorr
  const schnorr = new Schnorr();
  const pk_raw = await schnorr.computePublicKey(sk); // { x: Fr, y: Fr }
  
  // Convert Fr values to hex strings (32 bytes each)
  const publicKey = {
    x: frTo32BytesHex(pk_raw.x),
    y: frTo32BytesHex(pk_raw.y),
  };
  
  // Convert private key to hex string
  const privateKeyBuffer = sk.toBuffer();
  const privateKey = `0x${Buffer.from(privateKeyBuffer).toString('hex')}`;
  
  return {
    privateKey,
    publicKey,
  };
}

/**
 * Encrypt a value using ElGamal encryption with BabyJub
 * This is a placeholder - actual encryption must be done in Noir circuits
 */
export async function encryptValue(
  value: bigint,
  publicKey: BabyJubKeyPair['publicKey']
): Promise<Ciphertext> {
  // TODO: Implement ElGamal encryption
  // This should be done in Noir circuits, not in JavaScript
  // For now, return a placeholder ciphertext
  
  const valueBytes = new Uint8Array(32);
  const view = new DataView(valueBytes.buffer);
  view.setBigUint64(24, value, false); // big-endian, last 8 bytes
  
  // Placeholder: hash the value with the public key
  const combined = new Uint8Array(96); // 32 + 32 + 32
  combined.set(valueBytes, 0);
  combined.set(Buffer.from(publicKey.x.replace('0x', ''), 'hex'), 32);
  combined.set(Buffer.from(publicKey.y.replace('0x', ''), 'hex'), 64);
  
  const hash = await crypto.subtle.digest('SHA-256', combined);
  const hashBytes = new Uint8Array(hash);
  
  return {
    x1: `0x${Array.from(hashBytes.slice(0, 32))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')}`,
    x2: `0x${Array.from(hashBytes.slice(0, 32))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')}`,
  };
}

/**
 * Decrypt a ciphertext using private key
 * This is a placeholder - actual decryption must be done in Noir circuits
 */
export async function decryptValue(
  ciphertext: Ciphertext,
  privateKey: string
): Promise<bigint> {
  // TODO: Implement ElGamal decryption
  // This should be done in Noir circuits or a WASM module
  // For now, return 0 as placeholder
  
  console.warn('Decryption not implemented - requires Noir circuits');
  return BigInt(0);
}

/**
 * Homomorphically add two ciphertexts
 * This is a placeholder - actual operation must be done in Noir circuits
 */
export function homomorphicAdd(
  ct1: Ciphertext,
  ct2: Ciphertext
): Ciphertext {
  // TODO: Implement homomorphic addition
  // This should be done in Noir circuits
  // For now, return a placeholder
  
  console.warn('Homomorphic addition not implemented - requires Noir circuits');
  return {
    x1: ct1.x1,
    x2: ct1.x2,
  };
}

/**
 * Homomorphically subtract two ciphertexts
 * This is a placeholder - actual operation must be done in Noir circuits
 */
export function homomorphicSubtract(
  ct1: Ciphertext,
  ct2: Ciphertext
): Ciphertext {
  // TODO: Implement homomorphic subtraction
  // This should be done in Noir circuits
  // For now, return a placeholder
  
  console.warn('Homomorphic subtraction not implemented - requires Noir circuits');
  return {
    x1: ct1.x1,
    x2: ct1.x2,
  };
}

/**
 * Generate key bytes from public key (x, y) hex strings
 * Converts two 32-byte hex strings into a 64-byte Uint8Array
 * This matches the backend's generateKeyBytes function
 */
export function generateKeyBytes(pk: { x: string; y: string }): Uint8Array {
  // Remove '0x' prefix if present
  let xHex = pk.x.replace('0x', '');
  let yHex = pk.y.replace('0x', '');

  // Pad to 64 characters (32 bytes) if needed
  xHex = xHex.padStart(64, '0');
  yHex = yHex.padStart(64, '0');

  // Ensure hex strings are not longer than 64 characters (32 bytes)
  if (xHex.length > 64) {
    throw new Error(`Public key x hex string too long: ${xHex.length} characters (max 64)`);
  }
  if (yHex.length > 64) {
    throw new Error(`Public key y hex string too long: ${yHex.length} characters (max 64)`);
  }

  // Convert hex strings to Uint8Array (32 bytes each)
  const xBytes = new Uint8Array(
    xHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );
  const yBytes = new Uint8Array(
    yHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );

  // Ensure both are exactly 32 bytes
  if (xBytes.length !== 32) {
    throw new Error(`Public key x must be 32 bytes, got ${xBytes.length}`);
  }
  if (yBytes.length !== 32) {
    throw new Error(`Public key y must be 32 bytes, got ${yBytes.length}`);
  }

  // Concatenate x and y into a 64-byte array
  const pubBytes = new Uint8Array(64);
  pubBytes.set(xBytes, 0);
  pubBytes.set(yBytes, 32);

  return pubBytes;
}

export const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Helper function to extract 32 bytes as hex string
export const extract32Bytes = (bytes: Uint8Array, offset: number): string => {
  return bytesToHex(bytes.slice(offset, offset + 32));
};

// Helper function to convert hex string to decimal string (for Noir Field elements)
export const hexToDecimal = (hex: string): string => {
  // Remove '0x' prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  // Convert to BigInt and then to decimal string
  return BigInt('0x' + cleanHex).toString();
};
