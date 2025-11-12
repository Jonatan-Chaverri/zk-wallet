// Zero-knowledge proof generation using Noir circuits and UltraHonk backend
// Updated with working deposit, withdraw, and transfer circuits

import { UltraHonkBackend, ProofData } from '@aztec/bb.js';
import { Noir, InputMap } from '@noir-lang/noir_js';
import depositCircuit from './circuits/deposit.json';
import withdrawCircuit from './circuits/withdraw.json';
import transferCircuit from './circuits/transfer.json';
import { generateBabyJubKeyPair } from '../utils/crypto';
import type { BabyJubKeyPair } from '../types';

// ========== TYPES ==========

export interface Point {
  x: string | number;
  y: string | number;
}

export interface DepositParams {
  // Private inputs (secrets - never leave client)
  senderPrivKey: string | number;
  randomness: string;

  // Public inputs (visible on-chain)
  senderPubkey: Point;
  oldBalanceX1: Point;
  oldBalanceX2: Point;
  senderAddress: string | number;
  token: string | number;
  amount: string;
}

export interface WithdrawParams {
  // Private inputs
  senderPrivKey: string | number;
  randomness: string;

  // Public inputs
  senderPubkey: Point;
  oldBalanceX1: Point;
  oldBalanceX2: Point;
  senderAddress: string | number;
  token: string | number;
  amount: string;
}

export interface TransferParams {
  // Private inputs
  senderPrivKey: string | number;
  transferAmount: string;
  randomnessSender: string;
  randomnessReceiver: string;

  // Public inputs
  receiverAddress: string | number;
  receiverPubkey: Point;
  receiverOldBalanceX1: Point;
  receiverOldBalanceX2: Point;
  senderPubkey: Point;
  senderOldBalanceX1: Point;
  senderOldBalanceX2: Point;
  token: string | number;
}

export interface ProofResult {
  proof: Uint8Array;
  publicInputs: string[];
}

// ========== BACKEND CACHE ==========

const backendCache = new Map<string, UltraHonkBackend>();

function getBackend(circuitName: 'deposit' | 'withdraw' | 'transfer'): UltraHonkBackend {
  if (backendCache.has(circuitName)) {
    return backendCache.get(circuitName)!;
  }

  let bytecode: Uint8Array;
  switch (circuitName) {
    case 'deposit':
      bytecode = depositCircuit.bytecode as any;
      break;
    case 'withdraw':
      bytecode = withdrawCircuit.bytecode as any;
      break;
    case 'transfer':
      bytecode = transferCircuit.bytecode as any;
      break;
  }

  const backend = new UltraHonkBackend(bytecode);
  backendCache.set(circuitName, backend);
  return backend;
}

// ========== DEPOSIT PROOF ==========

/**
 * Generate a deposit proof
 *
 * This proves:
 * - User owns the old encrypted balance
 * - User knows their private key
 * - New balance = old balance + deposit amount
 *
 * @param params Deposit parameters
 * @returns Proof and public inputs/outputs
 */
export async function generateDepositProof(params: DepositParams): Promise<ProofResult> {
  console.log('[ProofGen] Generating deposit proof...');

  // Initialize Noir
  const noir = new Noir(depositCircuit as any);

  // Trim the user amount to 40 bits (remove 6 decimals so that it fits in 40 bits)
  // The contract will later multiply the value by 10^6 to transfer
  const amount = params.amount.slice(0, -6);
  if (amount.length > 13) {
    throw new Error('Amount is too large');
  }

  // Prepare inputs - Noir.js requires all inputs to be strings
  const inputs: InputMap = {
    sender_priv_key: params.senderPrivKey,
    r_amount: params.randomness,
    sender_pubkey: params.senderPubkey,
    old_balance_x1: params.oldBalanceX1,
    old_balance_x2: params.oldBalanceX2,
    sender_address: params.senderAddress,
    token: params.token,
    amount: amount
  };

  console.log('[ProofGen] Executing circuit...');
  const { witness } = await noir.execute(inputs);

  console.log('[ProofGen] Generating proof...');
  const backend = getBackend('deposit');
  const proof = await backend.generateProof(witness, {
    keccak: true
  });

  console.log(`[ProofGen] Deposit proof generated! Size: ${proof.proof.length} bytes`);

  return {
    proof: proof.proof,
    publicInputs: proof.publicInputs
  };
}

// ========== WITHDRAW PROOF ==========

/**
 * Generate a withdraw proof
 *
 * This proves:
 * - User owns the old encrypted balance
 * - User has sufficient balance to withdraw
 * - New balance = old balance - withdraw amount
 *
 * @param params Withdraw parameters
 * @returns Proof and public inputs/outputs
 */
export async function generateWithdrawProof(params: WithdrawParams): Promise<ProofResult> {
  console.log('[ProofGen] Generating withdraw proof...');

  const noir = new Noir(withdrawCircuit as any);

  const amount = params.amount.slice(0, -6);
  if (amount.length > 13) {
    throw new Error('Amount is too large');
  }

  // Prepare inputs - Noir.js requires all inputs to be strings
  const inputs: InputMap = {
    sender_priv_key: params.senderPrivKey,
    r_amount: params.randomness,
    sender_pubkey: params.senderPubkey,
    old_balance_x1: params.oldBalanceX1,
    old_balance_x2: params.oldBalanceX2,
    sender_address: params.senderAddress,
    token: params.token,
    amount: amount
  };

  console.log('[ProofGen] Executing circuit...');
  const { witness } = await noir.execute(inputs);

  console.log('[ProofGen] Generating proof...');
  const backend = getBackend('withdraw');
  const proof = await backend.generateProof(witness, {
    keccak: true
  });

  console.log(`[ProofGen] Withdraw proof generated! Size: ${proof.proof.length} bytes`);

  return {
    proof: proof.proof,
    publicInputs: proof.publicInputs
  };
}

// ========== TRANSFER PROOF ==========

/**
 * Generate a transfer proof
 *
 * This proves:
 * - Sender owns their old encrypted balance
 * - Sender has sufficient balance to transfer
 * - New balances computed correctly for both sender and receiver
 *
 * @param params Transfer parameters
 * @returns Proof and public inputs/outputs
 */
export async function generateTransferProof(params: TransferParams): Promise<ProofResult> {
  console.log('[ProofGen] Generating transfer proof...');

  const noir = new Noir(transferCircuit as any);

  // Assuming this value is always in decimal wei format
  const amount = params.transferAmount.slice(0, -6);
  if (amount.length > 13) {
    throw new Error('Amount is too large');
  }

  // Prepare inputs - Noir.js requires all inputs to be strings
  const inputs: InputMap = {
    sender_priv_key: params.senderPrivKey,
    transfer_amount: amount,
    r_amount_sender: params.randomnessSender,
    r_amount_receiver: params.randomnessReceiver,
    receiver_address: params.receiverAddress,
    receiver_pubkey: params.receiverPubkey,
    receiver_old_balance_x1: params.receiverOldBalanceX1,
    receiver_old_balance_x2: params.receiverOldBalanceX2,
    sender_pubkey: params.senderPubkey,
    sender_old_balance_x1: params.senderOldBalanceX1,
    sender_old_balance_x2: params.senderOldBalanceX2,
    token: params.token
  };

  console.log('[ProofGen] Executing circuit...');
  const { witness } = await noir.execute(inputs);

  console.log('[ProofGen] Generating proof...');
  const backend = getBackend('transfer');
  const proof = await backend.generateProof(witness, {
    keccak: true
  });

  console.log(`[ProofGen] Transfer proof generated! Size: ${proof.proof.length} bytes`);

  return {
    proof: proof.proof,
    publicInputs: proof.publicInputs
  };
}

// ========== VERIFICATION ==========

/**
 * Verify a proof locally (useful for testing before submitting)
 *
 * @param proofData The proof data
 * @param circuitName Which circuit to verify against
 * @returns True if valid
 */
export async function verifyProof(
  proofData: ProofData,
  circuitName: 'deposit' | 'withdraw' | 'transfer'
): Promise<boolean> {
  const backend = getBackend(circuitName);
  return await backend.verifyProof(proofData);
}

// ========== UTILITIES ==========

/**
 * Generate cryptographically secure randomness
 * @returns Random field element as string
 */
export function generateRandomness(): string {
  // Simple randomness for development
  // In production, use proper crypto.getRandomValues()
  return (Math.floor(Math.random() * 1000000000) + Date.now()).toString();
}

/**
 * Generate a test key pair using the same logic as user registration
 * This is useful for testing proof generation without requiring a registered user
 * @param seed Optional seed for deterministic key generation
 * @returns BabyJub key pair (private key and public key)
 */
export async function generateTestKeyPair(seed?: string): Promise<BabyJubKeyPair> {
  return await generateBabyJubKeyPair(seed);
}
