'use client';

import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useWallet } from '../hooks/useWallet';
import { useUser } from '../hooks/useUser';
import { useConfidentialERC20 } from '../hooks/useConfidentialERC20';
import { useProofs } from '../hooks/useProofs';
import { apiClient } from '../lib/utils/api';
import { savePrivateKey, getPrivateKey } from '../lib/utils/privateKeyStorage';
import { generateRandomness } from '../lib/noir/proofGeneration';
import { Address, parseUnits } from 'viem';

export default function DepositPage() {
  const { address, isConnected, connectWallet, isConnecting, privateKey } = useWallet();
  const { user } = useUser(address);
  const { balanceOfEnc, deposit: depositToContract, approveWETH } = useConfidentialERC20();
  const { generateDeposit, isGenerating: isGeneratingProof, error: proofError } = useProofs();

  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [tokens, setTokens] = useState<Array<{ name: string; network: string; address: string }>>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);
  
  // Combine proof generation state with deposit state
  const isLoading = isDepositing || isGeneratingProof;

  // Load private key from localStorage when address is available
  // Clear it when address is not available (disconnected)
  useEffect(() => {
    if (address) {
      const storedKey = getPrivateKey(address);
      if (storedKey) {
        setPrivateKeyInput(storedKey);
      } else {
        // Clear the input if no stored key exists (prevents restoring from component state)
        setPrivateKeyInput('');
      }
    } else {
      // Clear when disconnected
      setPrivateKeyInput('');
    }
  }, [address]);

  useEffect(() => {
    const fetchTokens = async () => {
      setIsLoadingTokens(true);
      try {
        const response = await apiClient.getTokens();
        setTokens(response.tokens);
        console.log('Available tokens:', response.tokens.map(t => t.name));
      } catch (error) {
        console.error('Failed to fetch tokens:', error);
      } finally {
        setIsLoadingTokens(false);
      }
    };

    if (isConnected) {
      fetchTokens();
    }
  }, [isConnected]);

  // Save private key to localStorage whenever it changes
  useEffect(() => {
    if (address && privateKeyInput.trim()) {
      savePrivateKey(address, privateKeyInput.trim());
    }
  }, [address, privateKeyInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError(null);
    setDepositSuccess(null);

    if (!address) {
      setDepositError('Wallet not connected');
      return;
    }

    if (!user?.public_key_x || !user.public_key_y) {
      setDepositError('User public key not found. Please register first.');
      return;
    }

    if (!token) {
      setDepositError('Please select a token');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setDepositError('Please enter a valid amount');
      return;
    }

    if (!privateKeyInput.trim()) {
      setDepositError('Please enter your private key');
      return;
    }

    setIsDepositing(true);

    try {
      // Get WETH token address from tokens list
      const wethToken = tokens.find(t => t.name === 'WETH_TOKEN_ADDRESS' || t.address.toLowerCase() === token.toLowerCase());
      if (!wethToken) {
        setDepositError('WETH token not found. Please ensure WETH is configured.');
        return;
      }

      const amountWei = parseUnits(amount, 18);

      // Approve WETH spending first
      setDepositError(null);
      // try {
      //   await approveWETH(wethToken.address as Address, amountWei);
      // } catch (approveErr: any) {
      //   console.error('WETH approval error:', approveErr);
      //   setDepositError(`Failed to approve WETH: ${approveErr.message || 'Unknown error'}`);
      //   return;
      // }

      // Get current encrypted balance
      const currentBalance = await balanceOfEnc(token as Address, address);
      
      // Convert current balance from Uint8Array to the format expected by prover
      const currentBalanceBytes = currentBalance instanceof Uint8Array 
        ? currentBalance 
        : new Uint8Array(currentBalance);

      // Helper function to convert bytes to hex string
      const bytesToHex = (bytes: Uint8Array): string => {
        return Array.from(bytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      };

      // Helper function to extract 32 bytes as hex string
      const extract32Bytes = (bytes: Uint8Array, offset: number): string => {
        return bytesToHex(bytes.slice(offset, offset + 32));
      };

      // Helper function to convert hex string to decimal string (for Noir Field elements)
      const hexToDecimal = (hex: string): string => {
        // Remove '0x' prefix if present
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        // Convert to BigInt and then to decimal string
        return BigInt('0x' + cleanHex).toString();
      };

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

      // Generate randomness as a numeric string (Noir Field expects integer)
      const randomness = generateRandomness();

      // Create sender public key as Point
      // Convert hex strings to decimal strings for Noir Field elements
      const senderPubkey = {
        x: user.public_key_x,
        y: user.public_key_y,
      };

      // Convert address and token to decimal strings for Noir Field elements
      const senderAddressDecimal = hexToDecimal(address);
      const tokenDecimal = hexToDecimal(token as string);

      // Convert private key from hex to decimal string before sending to circuit
      const senderPrivKeyDecimal = hexToDecimal(privateKeyInput.trim());

      // Generate proof and public inputs using the hook
      const params = {
        senderPrivKey: privateKeyInput.trim(),
        randomness: generateRandomness(),
        senderPubkey,
        oldBalanceX1,
        oldBalanceX2,
        senderAddress: address,
        token: token,
        amount: amountWei.toString(),
      };
      const { proof, publicInputs } = await generateDeposit(params);
      const publicInputsString = publicInputs.join('');
      console.log('publicInputsString:', publicInputsString);
      console.log('publicInputsString length:', publicInputsString.length);

      // Convert publicInputs from string[] to number[]
      // publicInputs are field elements as strings (hex or decimal), convert to numbers
      const publicInputsArray = publicInputs.map((input: string) => {
        // Try to parse as hex first (if it starts with 0x or looks like hex)
        if (input.startsWith('0x') || /^[0-9a-fA-F]+$/.test(input) && input.length > 10) {
          const hexString = input.startsWith('0x') ? input.slice(2) : input;
          const bigInt = BigInt('0x' + hexString);
          return Number(bigInt);
        } else {
          // Parse as decimal string
          return Number(input);
        }
      });

      // Call deposit function
      //const txHash = await depositToContract(publicInputsArray, proof);
      
      //setDepositSuccess(`Deposit successful! Transaction: ${txHash}`);
      setAmount(''); // Clear form on success
    } catch (err: any) {
      console.error('Deposit error:', err);
      const errorMessage = proofError || err.message || 'Failed to deposit tokens';
      setDepositError(errorMessage);
    } finally {
      setIsDepositing(false);
    }
  };

  if (!isConnected) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Deposit</h1>
          <p className="text-gray-600 mb-4">Please connect your MetaMask wallet to deposit tokens.</p>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="px-6 py-3 bg-brand-purple text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Deposit Tokens</h1>

        <form onSubmit={handleSubmit} className="bg-black border border-white rounded-xl p-6 shadow-lg space-y-6">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium mb-2 text-white">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              required
              className="w-full px-4 py-2 border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white bg-black text-white"
            />
          </div>

          <div>
            <label htmlFor="token" className="block text-sm font-medium mb-2 text-white">
              Token
            </label>
            <select
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              disabled={isLoadingTokens || tokens.length === 0}
              className="w-full px-4 py-2 border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white font-mono text-sm bg-black text-white disabled:bg-gray-800 disabled:cursor-not-allowed"
            >
              <option value="">
                {isLoadingTokens ? 'Loading tokens...' : tokens.length === 0 ? 'No tokens available' : 'Select a token'}
              </option>
              {tokens.map((t) => (
                <option key={t.address} value={t.address}>
                  {t.name} ({t.network})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="private_key" className="block text-sm font-medium mb-2 text-white">
              Private Key
            </label>
            <div className="relative">
              <input
                id="private_key"
                type={showPrivateKey ? 'text' : 'password'}
                value={privateKeyInput}
                onChange={(e) => setPrivateKeyInput(e.target.value)}
                placeholder={privateKey ? 'Using wallet private key (or enter custom)' : 'Enter private key'}
                required={!privateKey}
                className="w-full px-4 py-2 pr-10 border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white font-mono text-sm bg-black text-white"
              />
              <button
                type="button"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-brand-purple focus:outline-none"
                aria-label={showPrivateKey ? 'Hide private key' : 'Show private key'}
              >
                {showPrivateKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {privateKey && (
              <p className="text-xs text-gray-500 mt-1">
                Using private key from connected wallet. You can override it above.
              </p>
            )}
            {privateKeyInput && !privateKey && (
              <p className="text-xs text-gray-500 mt-1">
                Private key is saved locally and will be remembered for this wallet.
              </p>
            )}
          </div>

          {depositError && (
            <div className="bg-red-900/30 border border-red-500 rounded-lg p-3">
              <p className="text-sm text-red-300">{depositError}</p>
            </div>
          )}

          {depositSuccess && (
            <div className="bg-green-900/30 border border-green-500 rounded-lg p-3">
              <p className="text-sm text-green-300">{depositSuccess}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !user?.public_key_x || !user?.public_key_y}
            className="w-full px-6 py-3 bg-brand-purple text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isGeneratingProof ? 'Generating proof...' : isDepositing ? 'Depositing...' : 'Deposit'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
