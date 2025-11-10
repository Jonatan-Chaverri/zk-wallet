// ElGamal encryption/decryption using BabyJubJub curve via circomlibjs
// Based on the zkWallet circuit implementation

import { buildBabyjub } from 'circomlibjs';

let babyJub: any = null;

// Initialize BabyJub curve (singleton pattern)
async function initCurve() {
  if (!babyJub) {
    babyJub = await buildBabyjub();
  }
  return babyJub;
}

// Convert bigint to hex string for circuit
function toHex(value: bigint): string {
  return '0x' + value.toString(16).padStart(64, '0');
}

// Point structure for circuit (matches EmbeddedCurvePoint in Noir)
export interface Point {
  x: string;
  y: string;
}

// Ciphertext structure (ElGamal ciphertext = tuple of two points)
export interface Ciphertext {
  x1: Point;  // c1 = r·G
  x2: Point;  // c2 = r·H + m·G
}

/**
 * Generate random 253-bit field element for use as randomness
 * BabyJub field size requires values < 2^253
 */
export function generateRandomness(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  bytes[31] &= 0x1f; // Clear top 3 bits to get 253 bits
  const value = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  return toHex(value);
}

/**
 * Encrypt a message using ElGamal encryption on BabyJub curve
 *
 * ElGamal encryption:
 * - c1 = r·G (ephemeral key)
 * - c2 = r·H + m·G (encrypted message)
 *
 * Where:
 * - G = BabyJub generator point
 * - H = recipient's public key
 * - r = random scalar
 * - m = message (embedded as scalar multiplication of G)
 *
 * @param pubKey - Recipient's public key
 * @param message - Message to encrypt (as bigint)
 * @param randomness - Random value for encryption (must be fresh for each encryption)
 * @returns Ciphertext containing (x1, x2) points
 */
export async function encrypt(
  pubKey: Point,
  message: bigint,
  randomness: string
): Promise<Ciphertext> {
  const bjj = await initCurve();

  // Parse inputs
  const r = BigInt(randomness);
  const pubKeyPoint = [BigInt(pubKey.x), BigInt(pubKey.y)];

  // c1 = r * G (generator point)
  const c1 = bjj.mulPointEscalar(bjj.Base8, r);

  // c2 = r * pubKey + message * G
  const rPubKey = bjj.mulPointEscalar(pubKeyPoint, r);
  const messagePoint = bjj.mulPointEscalar(bjj.Base8, message);
  const c2 = bjj.addPoint(rPubKey, messagePoint);

  return {
    x1: { x: toHex(c1[0]), y: toHex(c1[1]) },
    x2: { x: toHex(c2[0]), y: toHex(c2[1]) }
  };
}

/**
 * Decrypt an ElGamal ciphertext using private key
 *
 * Decryption:
 * - s = privKey * c1
 * - messagePoint = c2 - s
 * - Recover m via discrete log (brute force for small values)
 *
 * Note: This implementation uses brute-force discrete log,
 * which only works for small values (< 10M). For production with
 * larger values, use baby-step-giant-step algorithm.
 *
 * @param ciphertext - Ciphertext to decrypt
 * @param privateKey - Private key (hex string)
 * @returns Decrypted message as bigint
 */
export async function decrypt(
  ciphertext: Ciphertext,
  privateKey: string
): Promise<bigint> {
  const bjj = await initCurve();

  const privKey = BigInt(privateKey);
  const c1 = [BigInt(ciphertext.x1.x), BigInt(ciphertext.x1.y)];
  const c2 = [BigInt(ciphertext.x2.x), BigInt(ciphertext.x2.y)];

  // Compute privKey * c1
  const s = bjj.mulPointEscalar(c1, privKey);

  // Compute c2 - s = message * G
  const negS = [s[0], bjj.F.neg(s[1])];
  const messagePoint = bjj.addPoint(c2, negS);

  // Discrete log to recover message (brute force - only works for small values)
  // For production, implement baby-step-giant-step for larger ranges
  for (let i = 0n; i < 10000000n; i++) {
    const testPoint = bjj.mulPointEscalar(bjj.Base8, i);
    if (testPoint[0] === messagePoint[0] && testPoint[1] === messagePoint[1]) {
      return i;
    }
  }

  throw new Error('Could not decrypt (message too large or invalid ciphertext)');
}

/**
 * Generate a BabyJub key pair
 *
 * @param seed - Optional seed for deterministic generation (for testing only)
 * @returns Key pair with privateKey (hex string) and publicKey (Point)
 */
export async function generateKeyPair(seed?: string): Promise<{
  privateKey: string;
  publicKey: Point
}> {
  const bjj = await initCurve();

  // Generate random private key (or use seed for deterministic generation)
  const privateKey = seed ?
    // For testing: hash the seed to get a private key
    toHex(BigInt('0x' + Array.from(new TextEncoder().encode(seed))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('').slice(0, 64))) :
    generateRandomness();

  const privKeyBigInt = BigInt(privateKey);

  // Public key = privKey * G
  const pubKeyPoint = bjj.mulPointEscalar(bjj.Base8, privKeyBigInt);

  return {
    privateKey,
    publicKey: {
      x: toHex(pubKeyPoint[0]),
      y: toHex(pubKeyPoint[1])
    }
  };
}

/**
 * Derive public key from private key
 *
 * @param privateKey - Private key (hex string)
 * @returns Public key as Point
 */
export async function derivePublicKey(privateKey: string): Promise<Point> {
  const bjj = await initCurve();
  const privKeyBigInt = BigInt(privateKey);
  const pubKeyPoint = bjj.mulPointEscalar(bjj.Base8, privKeyBigInt);

  return {
    x: toHex(pubKeyPoint[0]),
    y: toHex(pubKeyPoint[1])
  };
}

/**
 * Homomorphically add two ciphertexts
 * Only works when both ciphertexts are encrypted under THE SAME public key!
 *
 * Enc(a) + Enc(b) = Enc(a + b)
 *
 * @param ct1 - First ciphertext
 * @param ct2 - Second ciphertext
 * @returns Sum ciphertext
 */
export async function homomorphicAdd(
  ct1: Ciphertext,
  ct2: Ciphertext
): Promise<Ciphertext> {
  const bjj = await initCurve();

  const ct1_x1 = [BigInt(ct1.x1.x), BigInt(ct1.x1.y)];
  const ct1_x2 = [BigInt(ct1.x2.x), BigInt(ct1.x2.y)];
  const ct2_x1 = [BigInt(ct2.x1.x), BigInt(ct2.x1.y)];
  const ct2_x2 = [BigInt(ct2.x2.x), BigInt(ct2.x2.y)];

  const sum_x1 = bjj.addPoint(ct1_x1, ct2_x1);
  const sum_x2 = bjj.addPoint(ct1_x2, ct2_x2);

  return {
    x1: { x: toHex(sum_x1[0]), y: toHex(sum_x1[1]) },
    x2: { x: toHex(sum_x2[0]), y: toHex(sum_x2[1]) }
  };
}

/**
 * Homomorphically subtract two ciphertexts
 * Only works when both ciphertexts are encrypted under THE SAME public key!
 *
 * Enc(a) - Enc(b) = Enc(a - b)
 *
 * @param ct1 - First ciphertext
 * @param ct2 - Second ciphertext
 * @returns Difference ciphertext
 */
export async function homomorphicSubtract(
  ct1: Ciphertext,
  ct2: Ciphertext
): Promise<Ciphertext> {
  const bjj = await initCurve();

  const ct1_x1 = [BigInt(ct1.x1.x), BigInt(ct1.x1.y)];
  const ct1_x2 = [BigInt(ct1.x2.x), BigInt(ct1.x2.y)];
  const ct2_x1 = [BigInt(ct2.x1.x), BigInt(ct2.x1.y)];
  const ct2_x2 = [BigInt(ct2.x2.x), BigInt(ct2.x2.y)];

  // Negate ct2 by negating y-coordinates
  const neg_ct2_x1 = [ct2_x1[0], bjj.F.neg(ct2_x1[1])];
  const neg_ct2_x2 = [ct2_x2[0], bjj.F.neg(ct2_x2[1])];

  const diff_x1 = bjj.addPoint(ct1_x1, neg_ct2_x1);
  const diff_x2 = bjj.addPoint(ct1_x2, neg_ct2_x2);

  return {
    x1: { x: toHex(diff_x1[0]), y: toHex(diff_x1[1]) },
    x2: { x: toHex(diff_x2[0]), y: toHex(diff_x2[1]) }
  };
}
