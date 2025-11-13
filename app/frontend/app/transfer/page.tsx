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
import { convertTransferPublicInputs, parseUserBalance } from '../lib/utils/publicInputs';
import { parseUnits } from 'viem';
import type { Address } from 'viem';

export default function TransferPage() {
  const { address, isConnected, connectWallet, isConnecting, privateKey } = useWallet();
  const { user } = useUser(address);
  const { balanceOfEnc, transferConfidential, getUserPk } = useConfidentialERC20();
  const { generateTransfer, isGenerating: isGeneratingProof, error: proofError } = useProofs();

  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('');
  const [receiver, setReceiver] = useState('');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [tokens, setTokens] = useState<Array<{ name: string; network: string; address: string }>>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  
  // Combine proof generation state with transfer state
  const isLoading = isTransferring || isGeneratingProof;

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
    setTransferError(null);
    setTransferSuccess(null);

    if (!address) {
      setTransferError('Wallet not connected');
      return;
    }

    if (!user?.public_key_x || !user.public_key_y) {
      setTransferError('User public key not found. Please register first.');
      return;
    }

    if (!token) {
      setTransferError('Please select a token');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setTransferError('Please enter a valid amount');
      return;
    }

    if (!receiver || receiver.length < 5 || receiver.length > 42) {
      setTransferError('Receiver must be between 5 and 42 characters (address or username)');
      return;
    }

    if (!privateKeyInput.trim()) {
      setTransferError('Please enter your private key');
      return;
    }

    setIsTransferring(true);

    try {
      // Determine if receiver is an address or username
      const isAddress = receiver.length > 15 && receiver.startsWith('0x');
      
      // Fetch receiver data from /getUser API
      const getUserParams = isAddress 
        ? { address: receiver }
        : { username: receiver };
      
      const receiverResponse = await apiClient.getUser(getUserParams);
      
      if (!receiverResponse.success || !receiverResponse.user) {
        setTransferError('Receiver not found. Please check the address or username.');
        return;
      }

      const receiverUser = receiverResponse.user;
      const receiverAddress = receiverUser.address as Address;

      if (!receiverUser.public_key_x || !receiverUser.public_key_y) {
        setTransferError('Receiver has not registered their public key.');
        return;
      }

      let receiverPk = await getUserPk(receiverAddress);
      if (receiverPk.every(byte => byte === 0)) {
        setTransferError('Receiver has not registered their public key on chain.');
        return;
      }

      // Get balances for both sender and receiver
      const senderBalance = await balanceOfEnc(token as Address, address);
      const receiverBalance = await balanceOfEnc(token as Address, receiverAddress);

      // Parse balances
      const { oldBalanceX1: senderOldBalanceX1, oldBalanceX2: senderOldBalanceX2 } = parseUserBalance(senderBalance);
      const { oldBalanceX1: receiverOldBalanceX1, oldBalanceX2: receiverOldBalanceX2 } = parseUserBalance(receiverBalance);

      // Convert amount to wei
      const amountWei = parseUnits(amount, 18);
      if (amountWei.toString().length > 19) {
        setTransferError('Amount is too large');
        return;
      }

      // Create sender public key
      const senderPubkey = {
        x: user.public_key_x,
        y: user.public_key_y,
      };

      // Create receiver public key
      const receiverPubkey = {
        x: receiverUser.public_key_x,
        y: receiverUser.public_key_y,
      };

      // Generate proof and public inputs using the hook
      const params = {
        senderPrivKey: privateKeyInput.trim(),
        transferAmount: amountWei.toString(),
        randomnessSender: generateRandomness(),
        randomnessReceiver: generateRandomness(),
        receiverAddress: receiverAddress,
        receiverPubkey,
        receiverOldBalanceX1,
        receiverOldBalanceX2,
        senderPubkey,
        senderOldBalanceX1,
        senderOldBalanceX2,
        token: token,
      };
      
      console.log('Transfer params:', params);
      const { proof, publicInputs } = await generateTransfer(params);
      console.log('Transfer publicInputs length:', publicInputs.length);

      // Convert publicInputs from string[] to Uint8Array(704) matching contract layout
      const publicInputsArray = convertTransferPublicInputs(publicInputs);

      // Ensure proof is Uint8Array
      const proofBytes = proof instanceof Uint8Array ? proof : new Uint8Array(proof);

      // Call transferConfidential function
      const txHash = await transferConfidential(publicInputsArray, proofBytes);
      
      // Register transaction in backend
      try {
        await apiClient.registerTransaction({
          tx_hash: txHash,
          type: 'TRANSFER',
          token: token,
          amount: amountWei.toString(),
          sender_address: address,
          receiver_address: receiverAddress,
        });
        console.log('Transaction registered successfully');
      } catch (regError) {
        // Don't fail the transfer if registration fails
        console.error('Failed to register transaction:', regError);
      }
      
      setTransferSuccess(`Transfer successful! Transaction: ${txHash}`);
      setAmount(''); // Clear form on success
      setReceiver(''); // Clear receiver on success
    } catch (err: any) {
      console.error('Transfer error:', err);
      const errorMessage = proofError || err.message || 'Failed to transfer tokens';
      setTransferError(errorMessage);
    } finally {
      setIsTransferring(false);
    }
  };

  if (!isConnected) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Transfer</h1>
          <p className="text-gray-600 mb-4">Please connect your MetaMask wallet to transfer tokens.</p>
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
        <h1 className="text-3xl font-bold mb-6">Transfer Tokens</h1>

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
            <p className="text-xs text-gray-400 mt-1">
              This value will be private, hidden in the transaction
            </p>
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
            <label htmlFor="receiver" className="block text-sm font-medium mb-2 text-white">
              Receiver Address or Username
            </label>
            <input
              id="receiver"
              type="text"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              placeholder="0x... or username"
              required
              minLength={5}
              maxLength={42}
              className="w-full px-4 py-2 border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white bg-black text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter either a wallet address (0x..., 5-42 chars) or a username (5-42 chars)
            </p>
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

          {transferError && (
            <div className="bg-red-900/30 border border-red-500 rounded-lg p-3">
              <p className="text-sm text-red-300">{transferError}</p>
            </div>
          )}

          {transferSuccess && (
            <div className="bg-green-900/30 border border-green-500 rounded-lg p-3">
              <p className="text-sm text-green-300">{transferSuccess}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !user?.public_key_x || !user?.public_key_y}
            className="w-full px-6 py-3 bg-brand-purple text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isGeneratingProof ? 'Generating proof...' : isTransferring ? 'Transferring...' : 'Transfer'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
