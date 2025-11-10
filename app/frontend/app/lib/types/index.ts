// Type definitions for zkWallet

export interface BabyJubKeyPair {
  privateKey: string; // hex string
  publicKey: {
    x: string; // hex string (32 bytes)
    y: string; // hex string (32 bytes)
  };
}

export interface Ciphertext {
  x1: string; // hex string (32 bytes)
  x2: string; // hex string (32 bytes)
}

export interface Proof {
  proof: string; // hex string
  publicInputs: string; // hex string
}

export interface EncryptedBalance {
  token: string; // address
  user: string; // address
  ciphertext: Ciphertext;
}

export interface Transaction {
  hash: string;
  type: 'deposit' | 'withdraw' | 'transfer';
  token: string;
  amount?: string;
  from: string;
  to: string;
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
}

export interface WalletState {
  address: string | null;
  publicKey: BabyJubKeyPair['publicKey'] | null;
  privateKey: string | null; // stored in memory only, never sent to server
  balances: EncryptedBalance[];
  transactions: Transaction[];
}

export interface DepositParams {
  token: string;
  amount: bigint;
  newBalance: Ciphertext;
}

export interface TransferParams {
  token: string;
  to: string;
  amount: bigint;
  newFromBalance: Ciphertext;
  newToBalance: Ciphertext;
  proof: Proof;
}

export interface WithdrawParams {
  token: string;
  to: string;
  amount: bigint;
  newFromBalance: Ciphertext;
  proof: Proof;
}
