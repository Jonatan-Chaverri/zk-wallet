import { Address } from 'viem';

export interface Ciphertext {
  x1: string;
  x2: string;
}

export interface BabyJubPublicKey {
  x: string;
  y: string;
}

export interface DeployWalletRequest {
  owner: Address;
  confidentialERC20: Address;
}

export interface RegisterPublicKeyRequest {
  confidentialERC20: Address;
  userWalletAddress: Address;
  publicKey: BabyJubPublicKey;
}

export interface DepositRequest {
  userWalletAddress: Address;
  tokenAddress: Address;
  amount: string;
  newBalance: Ciphertext;
  to: Address;
  proofInputs: string;
  proof: string;
}

export interface WithdrawRequest {
  userWalletAddress: Address;
  tokenAddress: Address;
  recipient: Address;
  newBalance: Ciphertext;
  proofInputs: string;
  proof: string;
}

