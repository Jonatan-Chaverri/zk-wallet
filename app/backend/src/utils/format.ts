import path from 'path';
import fs from 'fs';

// This import ensures the file is included in the bundle:
import wasmUrl from '../stylus_artifacts/user_wallet.wasm?url'; // works with modern Next bundler

export const getUserWalletBytecode = () => {
  // Resolve path using process.cwd() (safe on Vercel)
  const wasmPath = path.join(process.cwd(), 'src/stylus_artifacts', 'user_wallet.wasm');
  const walletBytecode = '0x' + fs.readFileSync(wasmPath).toString('hex');
  return walletBytecode as `0x${string}`;
};
