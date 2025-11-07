// Zero-knowledge proof generation using Noir circuits and UltraHonk backend
// Migrated from client/ directory for frontend integration

import { UltraHonkBackend, ProofData } from '@aztec/bb.js';
import { Noir, InputMap } from '@noir-lang/noir_js';
import circuit from './circuits/wallet_proof.json';

// Types for circuit inputs (matches Noir circuit structure)
export interface EmbeddedCurvePoint {
    x: string;
    y: string;
    is_infinite: boolean;
}

export interface Ciphertext {
    x1: EmbeddedCurvePoint;
    x2: EmbeddedCurvePoint;
}

export interface TransferParams {
    // Private inputs (secrets - never leave client)
    currentBalance: bigint;
    transferAmount: bigint;
    r_old: string;
    r_new: string;
    r_transfer_recipient: string;
    senderPrivKey: string;           // Sender's private key (secret!)

    // Public inputs (visible to everyone)
    recipientPubKeyX: string;        // Recipient's public key x-coordinate (from blockchain!)
    recipientPubKeyY: string;        // Recipient's public key y-coordinate (from blockchain!)
    from: string;                     // Transaction metadata
    to: string;
    token: string;
    chainId: string;
    methodTag: string;
}

export interface ProofResult {
    proof: ProofData;
    publicInputs: string[];  // Array of hex strings (includes outputs)
}

/**
 * Generate a zero-knowledge proof for a confidential transfer
 *
 * This function:
 * 1. Executes the Noir circuit with the provided parameters
 * 2. Generates a ZK proof using UltraHonk backend
 * 3. Returns proof and public inputs/outputs
 *
 * IMPORTANT: The proof includes PUBLIC OUTPUTS (new encrypted balances)
 * that the contract will extract and use to update on-chain state.
 *
 * SECURITY MODEL:
 * - Sender provides their PRIVATE key (secret)
 * - Sender provides recipient's PUBLIC key (looked up from blockchain)
 * - Circuit computes sender's public key internally
 * - Circuit encrypts transfer using recipient's public key
 * - Only recipient can decrypt with their private key
 *
 * @param params - Transfer parameters including balances, keys, and metadata
 * @returns Proof and public inputs/outputs
 */
export async function generateTransferProof(params: TransferParams): Promise<ProofResult> {
    // Initialize Noir with the circuit
    const noir = new Noir(circuit as any);

    // Initialize UltraHonk backend with bytecode
    const backend = new UltraHonkBackend(circuit.bytecode as any);

    // 1. Prepare inputs according to circuit ABI
    const inputs: InputMap = {
        // Private inputs (secrets)
        current_balance: params.currentBalance.toString(),
        transfer_amount: params.transferAmount.toString(),
        r_old_balance: params.r_old,
        r_new_balance: params.r_new,
        r_transfer_recipient: params.r_transfer_recipient,
        sender_priv_key: params.senderPrivKey,  // Sender's private key

        // Public inputs - Recipient's public key coordinates
        recipient_pub_x: params.recipientPubKeyX,
        recipient_pub_y: params.recipientPubKeyY,

        // Transaction metadata
        from: params.from,
        to: params.to,
        token: params.token,
        chainId: params.chainId,
        methodTag: params.methodTag
    };

    console.log('[ProofGen] Executing circuit...');

    // 2. Execute circuit to get witness
    // This runs all the circuit logic and checks constraints
    const { witness } = await noir.execute(inputs);

    console.log('[ProofGen] Circuit executed successfully! Generating proof...');

    // 3. Generate proof using UltraHonk backend
    const proof = await backend.generateProof(witness);

    console.log('[ProofGen] Proof generated!');

    // 4. Extract public inputs from proof
    // IMPORTANT: This includes both public INPUTS and OUTPUTS (the new balances!)
    const publicInputs = proof.publicInputs;

    console.log('[ProofGen] Proof generation complete!');
    console.log(`[ProofGen] Proof size: ${proof.proof.length} bytes`);
    console.log(`[ProofGen] Public inputs: ${publicInputs.length} values`);

    return {
        proof,           // ProofData - contains proof bytes and public inputs
        publicInputs     // string[] - hex strings of public inputs + outputs
    };
}

/**
 * Verify a proof (useful for testing client-side before submitting)
 *
 * @param proofData - The proof data object
 * @returns True if proof is valid
 */
export async function verifyProof(proofData: ProofData): Promise<boolean> {
    // Initialize backend with circuit bytecode
    const backend = new UltraHonkBackend(circuit.bytecode as any);

    // Verify proof
    const isValid = await backend.verifyProof(proofData);
    return isValid;
}
