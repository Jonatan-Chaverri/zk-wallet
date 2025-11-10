'use client';

import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useUser } from '../hooks/useUser';

export function WalletStatus() {
  const { address, isConnected, isConnecting, error, connectWallet, disconnect } = useWallet();
  const { user, isLoading: isLoadingUser, isRegistered, register, clearUser } = useUser(address);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setRegisterError('Username is required');
      return;
    }

    setIsRegistering(true);
    setRegisterError(null);

    try {
      const userSecret = await register(username.trim());
      setShowRegisterModal(false);
      setUsername('');
      setSecret(userSecret);
      setShowSecretModal(true);
    } catch (err: any) {
      setRegisterError(err.message || 'Failed to register');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCopySecret = async () => {
    if (!secret) return;

    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy secret:', err);
      // Fallback for older browsers
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

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">Your Wallet</p>
          <p className="text-sm font-mono text-black">
            {address.slice(0, 8)}...{address.slice(-6)}
          </p>
        </div>
        
        {/* Show Register button if not registered, or username button if registered */}
        {isLoadingUser ? (
          <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>
        ) : isRegistered && user ? (
          <button
            className="px-4 py-2 border border-black rounded-xl bg-white text-black hover:bg-gray-50 transition-colors text-sm font-medium"
            title={`Username: ${user.name}`}
          >
            {user.name}
          </button>
        ) : (
          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 border border-black rounded-xl bg-white text-black hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Register
          </button>
        )}

        <button
          onClick={() => {
            clearUser();
            disconnect();
          }}
          className="px-4 py-2 border border-black rounded-xl bg-white text-black hover:bg-gray-50 transition-colors text-sm"
        >
          Disconnect
        </button>

        {/* Register Modal */}
        {showRegisterModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 border border-black">
              <h2 className="text-xl font-bold mb-4">Register</h2>
              <form onSubmit={handleRegister}>
                <div className="mb-4">
                  <label htmlFor="username" className="block text-sm font-medium mb-2">
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
                    placeholder="Enter a cool username"
                    className="w-full px-4 py-2 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    disabled={isRegistering}
                    minLength={3}
                    maxLength={50}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    3-50 characters, alphanumeric and underscores
                  </p>
                </div>
                
                {registerError && (
                  <p className="text-sm text-red-600 mb-4">{registerError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(false);
                      setUsername('');
                      setRegisterError(null);
                    }}
                    className="flex-1 px-4 py-2 border border-black rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={isRegistering}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRegistering || !username.trim()}
                    className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRegistering ? 'Registering...' : 'Register'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Secret Modal */}
        {showSecretModal && secret && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 border border-black">
              <div className="mb-4">
                <h2 className="text-xl font-bold mb-2">Registration Successful!</h2>
                <p className="text-sm text-gray-600">
                  Your account has been created. Please save your secret key securely. You won't be able to see it again.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Your Secret Key
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg font-mono text-sm break-all">
                    {secret}
                  </div>
                  <button
                    onClick={handleCopySecret}
                    className="px-4 py-3 border border-black rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap text-sm font-medium"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <span className="text-green-600">✓ Copied!</span>
                    ) : (
                      <span>Copy</span>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-yellow-800">
                  <strong>⚠️ Important:</strong> Store this secret in a safe place. If you lose it, you may not be able to recover your account.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowSecretModal(false);
                  setSecret(null);
                  setCopied(false);
                }}
                className="w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
              >
                I've Saved My Secret
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
      >
        {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
      </button>
    </div>
  );
}
