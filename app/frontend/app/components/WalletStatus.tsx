'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useWallet } from '../hooks/useWallet';
import { useUser } from '../hooks/useUser';

export function WalletStatus() {
  const router = useRouter();
  const { address, isConnected, isConnecting, error, connectWallet } = useWallet();
  const { user, isLoading: isLoadingUser, isRegistered } = useUser(address);
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch by only rendering wallet-dependent content after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Render a placeholder during SSR to prevent hydration mismatch
  if (!isMounted) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          disabled
          className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl opacity-50 cursor-not-allowed transition-colors font-medium text-sm"
        >
          Connect Wallet <Image src="/metamask.png" alt="MetaMask" width={20} height={20} />
        </button>
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-4">
        {/* Show Register button if not registered, or My Account link if registered */}
        {isLoadingUser ? (
          <div className="px-4 py-2 text-sm text-gray-400">Loading...</div>
        ) : isRegistered && user ? (
          <Link
            href="/my-account"
            className="flex flex-row items-center gap-2 px-4 py-2 rounded-xl bg-brand-purple text-white hover:bg-brand-purple-dark transition-colors"
          >
            <svg 
              className="w-5 h-5 flex-shrink-0" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
              />
            </svg>
            <span className="text-xs font-medium whitespace-nowrap">
              {user.name}
            </span>
          </Link>
        ) : (
          <button
            onClick={() => router.push('/register')}
            className="px-4 py-2 rounded-xl bg-white text-black hover:bg-brand-purple hover:text-white transition-colors text-sm font-medium"
          >
            Register
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className="flex items-center gap-2 px-6 py-2 bg-white text-black rounded-xl hover:bg-brand-purple hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
      >
        {isConnecting ? (
          'Connecting...'
        ) : (
          <>
            Connect Wallet <Image src="/metamask.png" alt="MetaMask" width={20} height={20} />
          </>
        )}
      </button>
    </div>
  );
}
