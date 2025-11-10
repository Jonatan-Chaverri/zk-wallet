import express from 'express';
import { UserService } from '../db/services/userService';
import { randomBytes } from 'crypto';

const router = express.Router();

interface RegisterRequest {
  address: string;
  username: string;
}

/**
 * POST /api/register
 * Register a new user with address and username
 * Returns a random secret
 */
router.post('/', async (req, res, next) => {
  try {
    const { address, username }: RegisterRequest = req.body;

    // Validate required fields
    if (!address || !username) {
      return res.status(400).json({
        error: 'Missing required fields: address and username are required',
      });
    }

    // Validate address format (basic check)
    if (!address.startsWith('0x') || address.length !== 42) {
      return res.status(400).json({
        error: 'Invalid address format. Expected Ethereum address (0x...)',
      });
    }

    // Validate username format
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({
        error: 'Username must be between 3 and 50 characters',
      });
    }

    // Check if user with same address exists
    const existingUserByAddress = await UserService.getUserByAddress(address);
    if (existingUserByAddress) {
      return res.status(409).json({
        error: 'User with this address already exists',
      });
    }

    // Check if user with same username exists
    const existingUserByUsername = await UserService.getUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(409).json({
        error: 'Username already taken',
      });
    }

    // Generate a random secret (32 bytes = 64 hex characters)
    const secret = randomBytes(32).toString('hex');

    // Create user
    // Note: public_key is required in the schema, so we'll use a placeholder
    // that indicates it needs to be set. The public_key should be set via
    // a separate endpoint after the user generates their key pair.
    const placeholderPublicKey = `pending_${randomBytes(16).toString('hex')}`;
    
    const user = await UserService.createUser({
      name: username,
      address: address.toLowerCase(), // Normalize to lowercase
      public_key: placeholderPublicKey, // Placeholder - should be updated via another endpoint
    });

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        address: user.address,
        username: user.name,
        created_at: user.created_at,
      },
      secret, // Return the secret (client should store this securely)
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;

