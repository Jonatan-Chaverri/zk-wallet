/**
 * Test Data for Development
 *
 * This file contains pre-computed test accounts with valid cryptographic data.
 * These values were generated using Noir to ensure compatibility with circuits.
 *
 * Use these for development until you implement dynamic ElGamal operations.
 */

import { Point } from './proofGeneration';

export interface TestAccount {
  name: string;
  privateKey: string;
  publicKey: Point;
  encryptedBalance: {
    x1: Point;
    x2: Point;
  };
  balance: string; // Plaintext balance (user knows this from decryption)
}

export const TEST_ACCOUNTS: Record<string, TestAccount> = {
  alice: {
    name: 'Alice',
    privateKey: '42',
    publicKey: {
      x: '7356913722468763155518092886238006860757299964193402191943647957243737021149',
      y: '8353686781200727416994686754908207716480106082647483667993604622182232784267'
    },
    // Pre-encrypted balance of 500 tokens (generated with Noir)
    encryptedBalance: {
      x1: {
        x: '4975362976902519270991051485761515025451487065608113469365554307533714678904',
        y: '11107342823962471378327065917659110680364498807938611326388672169911937649323'
      },
      x2: {
        x: '9863331575647124993747572899844356693180873101289877909455720458809493493815',
        y: '20667496008998255495504838139471524687995529485879200038689438738233366509677'
      }
    },
    balance: '500'
  }
};

/**
 * Get a test account by name
 * @param accountName Name of the test account
 * @returns Test account data
 */
export function getTestAccount(accountName: keyof typeof TEST_ACCOUNTS = 'alice'): TestAccount {
  const account = TEST_ACCOUNTS[accountName];
  if (!account) {
    throw new Error(`Test account '${accountName}' not found`);
  }
  return account;
}

/**
 * Check if we're using test data (for development mode detection)
 * @param privateKey The private key to check
 * @returns True if this is a test account
 */
export function isTestAccount(privateKey: string): boolean {
  return Object.values(TEST_ACCOUNTS).some(account => account.privateKey === privateKey);
}
