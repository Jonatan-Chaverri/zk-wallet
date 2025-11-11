'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '../components/Layout';
import { useWallet } from '../hooks/useWallet';
import { useUser } from '../hooks/useUser';

export default function RegisterPage() {
  const router = useRouter();
  const { address, isConnected, connectWallet, isConnecting, disconnect } = useWallet();
  const { user, isLoading: isLoadingUser, isRegistered, register, clearUser } = useUser(address);
  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Redirect if already registered
  useEffect(() => {
    if (isMounted && isRegistered && user) {
      router.push('/my-account');
    }
  }, [isMounted, isRegistered, user, router]);

  const handleCopySecret = async () => {
    if (!secret) return;

    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy secret:', err);
      const textArea = document.createElement('textarea');
      textArea.value = secret;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setRegisterError('Username is required');
      return;
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 5 || trimmedUsername.length > 13) {
      setRegisterError('Username must be between 5 and 13 characters');
      return;
    }

    setIsRegistering(true);
    setRegisterError(null);

    try {
      const userSecret = await register(trimmedUsername);
      setSecret(userSecret);
    } catch (err: any) {
      setRegisterError(err.message || 'Failed to register');
    } finally {
      setIsRegistering(false);
    }
  };

  if (!isMounted) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-white">Register</h1>
          <p className="text-white">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!isConnected) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-white">Register</h1>
          <p className="text-white mb-4">Please connect your MetaMask wallet to register.</p>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="px-6 py-3 bg-white text-black rounded-xl hover:bg-brand-purple hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
          </button>
        </div>
      </Layout>
    );
  }

  if (isLoadingUser) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-white">Register</h1>
          <p className="text-white">Checking registration status...</p>
        </div>
      </Layout>
    );
  }

  // Show secret modal if registration was successful
  if (secret) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="bg-black border border-white rounded-xl p-6 shadow-lg">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-2 text-white">Registration Successful!</h2>
              <p className="text-sm text-gray-300">
                Your account has been created. Please save your secret key securely. You won&apos;t be able to see it again.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-white">
                Your Secret Key
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm break-all text-white">
                  {secret}
                </div>
                <button
                  onClick={handleCopySecret}
                  className="px-4 py-3 border border-white rounded-lg hover:bg-brand-purple transition-colors whitespace-nowrap text-sm font-medium text-white"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <span className="text-green-400">✓ Copied!</span>
                  ) : (
                    <span>Copy</span>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-3 mb-4">
              <p className="text-xs text-yellow-200">
                <strong>⚠️ Important:</strong> Store this secret in a safe place. If you lose it, you may not be able to recover your account.
              </p>
            </div>

            <button
              onClick={() => {
                router.push('/my-account');
              }}
              className="w-full px-4 py-2 bg-white text-black rounded-lg hover:bg-brand-purple hover:text-white transition-colors font-medium"
            >
              Go to My Account
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-white">Register Your Account</h1>

        {/* Registration Form */}
        <div className="bg-black border border-white rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold mb-4 text-white">Create Your Account</h2>
          <form onSubmit={handleRegister}>
            <div className="mb-4">
              <label htmlFor="username" className="block text-sm font-medium mb-2 text-white">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setRegisterError(null);
                }}
                placeholder="Enter your username (5-13 characters)"
                className="w-full px-4 py-2 border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white bg-black text-white placeholder-gray-400"
                disabled={isRegistering}
                minLength={5}
                maxLength={13}
              />
              <p className="text-xs text-gray-400 mt-1">
                5-13 characters, alphanumeric and underscores only
              </p>
            </div>
            
            {registerError && (
              <div className="bg-red-900 border border-red-700 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-200">{registerError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isRegistering || !username.trim() || username.trim().length < 5 || username.trim().length > 13}
              className="w-full px-6 py-3 bg-white text-black rounded-xl hover:bg-brand-purple hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isRegistering ? 'Registering...' : 'Register Account'}
            </button>
          </form>
        </div>

        {/* Information Section */}
        <div className="bg-black border border-white rounded-xl p-6 shadow-lg mb-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold mb-2 text-white">🔐 Key Generation</h2>
            <p className="text-sm text-gray-300">
              When you register, the app will automatically generate a public and private key pair associated with your account. 
              These keys are used to encrypt and decrypt your balance information.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold mb-2 text-white">🔑 Private Key Responsibility</h2>
            <p className="text-sm text-gray-300">
              <strong>You are the only one responsible for handling your private key.</strong> The app will show you your private key 
              once during registration. Make sure to save it securely - if you lose it, you may not be able to recover your account 
              or decrypt your balance.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold mb-2 text-white">👤 Username Requirements</h2>
            <p className="text-sm text-gray-300">
              Choose a unique username between <strong>5 and 13 characters</strong>. This username will be used by other users 
              to send you money through the app. Make sure it&apos;s memorable and unique!
            </p>
          </div>
        </div>

        {/* Connected Wallet Address */}
        {address && (
          <div className="bg-black border border-white rounded-xl p-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-1">Connected Wallet</p>
                <p className="text-sm font-mono text-white break-all">
                  {address}
                </p>
              </div>
              <button
                onClick={async () => {
                  clearUser();
                  disconnect();
                  // Wait a bit to ensure disconnect state updates propagate
                  await new Promise(resolve => setTimeout(resolve, 200));
                  // Force a full page reload to ensure all state is cleared
                  window.location.href = '/';
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors text-sm font-medium whitespace-nowrap w-full sm:w-auto"
              >
                Cancel & Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

