import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WalletState, EncryptedBalance, Transaction, BabyJubKeyPair } from '../types';

interface WalletStore extends WalletState {
  // Actions
  setAddress: (address: string | null) => void;
  setKeyPair: (keyPair: BabyJubKeyPair | null) => void;
  setPublicKey: (publicKey: BabyJubKeyPair['publicKey'] | null) => void;
  addBalance: (balance: EncryptedBalance) => void;
  updateBalance: (token: string, ciphertext: EncryptedBalance['ciphertext']) => void;
  addTransaction: (tx: Transaction) => void;
  clearWallet: () => void;
}

const initialState: WalletState = {
  address: null,
  publicKey: null,
  privateKey: null,
  balances: [],
  transactions: [],
};

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      ...initialState,
      setAddress: (address) => set({ address }),
      setKeyPair: (keyPair) =>
        set({
          publicKey: keyPair?.publicKey || null,
          privateKey: keyPair?.privateKey || null,
        }),
      setPublicKey: (publicKey) =>
        set({
          publicKey: publicKey || null,
        }),
      addBalance: (balance) =>
        set((state) => ({
          balances: [...state.balances.filter((b) => b.token !== balance.token || b.user !== balance.user), balance],
        })),
      updateBalance: (token, ciphertext) =>
        set((state) => ({
          balances: state.balances.map((b) =>
            b.token === token ? { ...b, ciphertext } : b
          ),
        })),
      addTransaction: (tx) =>
        set((state) => ({
          transactions: [tx, ...state.transactions].slice(0, 50), // Keep last 50
        })),
      clearWallet: () => set(initialState),
    }),
    {
      name: 'zkwallet-storage',
      partialize: (state) => ({
        address: state.address,
        publicKey: state.publicKey,
        // NOTE: Never persist privateKey to localStorage in production!
        // This is for development only. Use secure key management in production.
        balances: state.balances,
        transactions: state.transactions,
      }),
    }
  )
);
