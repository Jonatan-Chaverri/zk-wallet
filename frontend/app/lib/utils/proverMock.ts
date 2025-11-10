/**
 * Mock prover for deposit/withdraw operations
 * Generates fake proofs and public inputs for testing
 */

/**
 * Get deposit/withdraw public inputs
 * @param userPubkey - User's public key as 64 bytes (x||y, each 32 bytes)
 * @param userAddress - User's Ethereum address
 * @param token - Token contract address
 * @param amount - Amount to deposit/withdraw (as bigint or string)
 * @param currentBalance - Current encrypted balance as 128 bytes (x1.x, x1.y, x2.x, x2.y)
 * @returns Packed public inputs as Uint8Array (416 bytes)
 */
export function getDepositWithdrawPublicInputs(
  userPubkey: Uint8Array | number[],
  userAddress: string,
  token: string,
  amount: bigint | string,
  currentBalance: Uint8Array | number[]
): Uint8Array {
  // Ensure user pubkey is 64 bytes (x||y)
  const userPubKeyBytes = Uint8Array.from(userPubkey.map(b => Number(b)));
  if (userPubKeyBytes.length !== 64) {
    throw new Error(`User pubkey must be 64 bytes, got ${userPubKeyBytes.length}`);
  }

  // Pad addresses to 32 bytes
  const paddedUserAddr = padAddress(userAddress);
  const paddedTokenAddr = padAddress(token);

  // Helper to split bytes array
  const splitToBytes = (arr: Uint8Array | number[], start: number, end: number): Uint8Array => {
    return Uint8Array.from(arr.slice(start, end).map(Number));
  };

  // Parse current balance (128 bytes: x1.x, x1.y, x2.x, x2.y)
  const currentBalanceArray = Uint8Array.from(currentBalance.map(b => Number(b)));
  if (currentBalanceArray.length !== 128) {
    throw new Error(`Current balance must be 128 bytes, got ${currentBalanceArray.length}`);
  }

  const current_balance_x1_x = splitToBytes(currentBalanceArray, 0, 32);
  const current_balance_x1_y = splitToBytes(currentBalanceArray, 32, 64);
  const current_balance_x2_x = splitToBytes(currentBalanceArray, 64, 96);
  const current_balance_x2_y = splitToBytes(currentBalanceArray, 96, 128);

  // Generate fake new balance (random bytes for demo)
  const new_balance_x1_x = generateRandomBytes(32);
  const new_balance_x1_y = generateRandomBytes(32);
  const new_balance_x2_x = generateRandomBytes(32);
  const new_balance_x2_y = generateRandomBytes(32);

  // Convert amount to bigint and then to 32-byte array
  const amountBigInt = typeof amount === 'string' ? BigInt(amount) : amount;
  const amountBytes = bigIntToBytes32(amountBigInt);

  // Pack in the same order Noir expects
  // Structure: user_pubkey.x (32), user_pubkey.y (32),
  //            current_balance_x1.x (32), current_balance_x1.y (32),
  //            current_balance_x2.x (32), current_balance_x2.y (32),
  //            new_balance_x1.x (32), new_balance_x1.y (32),
  //            new_balance_x2.x (32), new_balance_x2.y (32),
  //            user_address (32), token (32), amount (32)
  // Total: 12 * 32 = 384 bytes... wait, let me check the contract
  
  // Actually looking at the contract, it expects 416 bytes
  // Let me count: 2 (pubkey) + 4 (current balance) + 4 (new balance) + 1 (address) + 1 (token) + 1 (amount) = 13 * 32 = 416 bytes
  
  const packed = new Uint8Array(416);
  let offset = 0;

  // user_pubkey.x (32 bytes)
  packed.set(userPubKeyBytes.slice(0, 32), offset);
  offset += 32;

  // user_pubkey.y (32 bytes)
  packed.set(userPubKeyBytes.slice(32, 64), offset);
  offset += 32;

  // current_balance_x1.x (32 bytes)
  packed.set(current_balance_x1_x, offset);
  offset += 32;

  // current_balance_x1.y (32 bytes)
  packed.set(current_balance_x1_y, offset);
  offset += 32;

  // current_balance_x2.x (32 bytes)
  packed.set(current_balance_x2_x, offset);
  offset += 32;

  // current_balance_x2.y (32 bytes)
  packed.set(current_balance_x2_y, offset);
  offset += 32;

  // new_balance_x1.x (32 bytes)
  packed.set(new_balance_x1_x, offset);
  offset += 32;

  // new_balance_x1.y (32 bytes)
  packed.set(new_balance_x1_y, offset);
  offset += 32;

  // new_balance_x2.x (32 bytes)
  packed.set(new_balance_x2_x, offset);
  offset += 32;

  // new_balance_x2.y (32 bytes)
  packed.set(new_balance_x2_y, offset);
  offset += 32;

  // user_address (32 bytes, padded)
  packed.set(paddedUserAddr, offset);
  offset += 32;

  // token (32 bytes, padded)
  packed.set(paddedTokenAddr, offset);
  offset += 32;

  // amount (32 bytes)
  packed.set(amountBytes, offset);
  offset += 32;

  return packed;
}

/**
 * Generate deposit/withdraw proof (mock)
 * @param userPubkey - User's public key as 64 bytes (x||y)
 * @param userAddress - User's Ethereum address
 * @param token - Token contract address
 * @param amount - Amount to deposit/withdraw
 * @param currentBalance - Current encrypted balance as 128 bytes
 * @returns Object with public_inputs and proof
 */
export function generateDepositWithdrawProof(
  userPubkey: Uint8Array | number[],
  userAddress: string,
  token: string,
  amount: bigint | string,
  currentBalance: Uint8Array | number[]
): { public_inputs: Uint8Array; proof: Uint8Array } {
  const public_inputs = getDepositWithdrawPublicInputs(
    userPubkey,
    userAddress,
    token,
    amount,
    currentBalance
  );
  
  // Generate fake proof (32 random bytes for demo)
  const proof = generateRandomBytes(32);
  
  return { public_inputs, proof };
}

/**
 * Helper: Pad Ethereum address to 32 bytes
 */
function padAddress(address: string): Uint8Array {
  // Remove 0x prefix if present
  const addr = address.startsWith('0x') ? address.slice(2) : address;
  
  // Convert to bytes (20 bytes for address)
  const addrBytes = new Uint8Array(
    addr.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );
  
  // Pad to 32 bytes (left-padded with zeros)
  const padded = new Uint8Array(32);
  padded.set(addrBytes, 12); // Address goes in the last 20 bytes
  
  return padded;
}

/**
 * Helper: Convert bigint to 32-byte array (big-endian)
 */
function bigIntToBytes32(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let v = value;
  
  // Convert to big-endian bytes
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn);
    v = v >> 8n;
  }
  
  return bytes;
}

/**
 * Helper: Generate random bytes
 */
function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    // Fallback for Node.js or environments without crypto
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

