use elgamal::{add_ciphertexts, CipherText, encrypt, public_key, decrypt, verify_embedding};
use std::embedded_curve_ops::EmbeddedCurvePoint;

// ==================== CUSTOM TYPES ====================

// Point without is_infinite flag (matches contract expectations)
struct Point {
    x: Field,
    y: Field
}

// ==================== HELPER FUNCTIONS ====================

fn verify_sender(
    sender_priv_key: Field,
    sender_pubkey: EmbeddedCurvePoint,
    old_balance_ct: CipherText,
    current_balance: Field
) {
    // Enforce 40-bit range constraint
    current_balance.assert_max_bit_size::<40>();

    // Verify sender's public key matches their private key
    let computed_sender_pubkey = public_key(sender_priv_key);
    assert(computed_sender_pubkey == sender_pubkey);

    // Verify sender knows the decryption of their old balance
    let decrypted_old_balance = decrypt(old_balance_ct, sender_priv_key);
    verify_embedding(decrypted_old_balance, current_balance);
}

fn verify_sufficient_balance(current_balance: Field, amount: Field) {
    // Cast to u64 for comparison
    let balance_u64 = current_balance as u64;
    let amount_u64 = amount as u64;
    assert(balance_u64 >= amount_u64);
}

// ==================== TRANSFER CIRCUIT ====================
// Allows users to privately transfer tokens to another user
// Uses homomorphic addition for receiver's balance (no receiver private key needed!)
//
// PUBLIC INPUTS/OUTPUTS BYTE LAYOUT (matching Rust contract):
// [0..32]:     receiver_address (32)
// [32..96]:    receiver_pubkey (x: 32, y: 32)
// [96..224]:   receiver_current_balance (x1.x: 32, x1.y: 32, x2.x: 32, x2.y: 32)
// [224..352]:  receiver_new_balance (x1.x: 32, x1.y: 32, x2.x: 32, x2.y: 32) - OUTPUT
// [352..416]:  sender_pubkey (x: 32, y: 32)
// [416..544]:  sender_current_balance (x1.x: 32, x1.y: 32, x2.x: 32, x2.y: 32)
// [544..672]:  sender_new_balance (x1.x: 32, x1.y: 32, x2.x: 32, x2.y: 32) - OUTPUT
// [672..704]:  token (32)
// Total: 704 bytes

fn main(
    // Private inputs (secrets not revealed in proof)
    sender_priv_key: Field,
    current_balance_sender: Field,  // Sender's plaintext balance
    transfer_amount: Field,          // Amount to transfer
    r_new_balance_sender: Field,     // Randomness for sender's new balance
    r_transfer_amount: Field,        // Randomness for encrypting transfer to receiver

    // Public inputs (visible in proof) - ORDER MATTERS for contract!
    receiver_address: pub Field,
    receiver_pubkey: pub Point,
    receiver_old_balance_x1: pub Point,
    receiver_old_balance_x2: pub Point,
    sender_pubkey: pub Point,
    sender_old_balance_x1: pub Point,
    sender_old_balance_x2: pub Point,
    token: pub Field
) -> pub (
    Point,  // receiver_new_balance_x1
    Point,  // receiver_new_balance_x2
    Point,  // sender_new_balance_x1
    Point   // sender_new_balance_x2
) {
    // Reconstruct EmbeddedCurvePoint and CipherText structs from Point structs
    let sender_pubkey_ec = EmbeddedCurvePoint {
        x: sender_pubkey.x,
        y: sender_pubkey.y,
        is_infinite: false
    };

    let receiver_pubkey_ec = EmbeddedCurvePoint {
        x: receiver_pubkey.x,
        y: receiver_pubkey.y,
        is_infinite: false
    };

    let old_balance_sender_ct: CipherText = (
        EmbeddedCurvePoint { x: sender_old_balance_x1.x, y: sender_old_balance_x1.y, is_infinite: false },
        EmbeddedCurvePoint { x: sender_old_balance_x2.x, y: sender_old_balance_x2.y, is_infinite: false }
    );

    let old_balance_receiver_ct: CipherText = (
        EmbeddedCurvePoint { x: receiver_old_balance_x1.x, y: receiver_old_balance_x1.y, is_infinite: false },
        EmbeddedCurvePoint { x: receiver_old_balance_x2.x, y: receiver_old_balance_x2.y, is_infinite: false }
    );

    // Enforce range constraints
    transfer_amount.assert_max_bit_size::<40>();

    // Verify sender authentication and balance knowledge
    verify_sender(sender_priv_key, sender_pubkey_ec, old_balance_sender_ct, current_balance_sender);

    // Verify sender has sufficient balance
    verify_sufficient_balance(current_balance_sender, transfer_amount);

    // Calculate sender's new balance
    let new_balance_sender = current_balance_sender - transfer_amount;
    new_balance_sender.assert_max_bit_size::<40>();

    // Encrypt sender's new balance
    let new_balance_sender_ct = encrypt(sender_pubkey_ec, new_balance_sender, r_new_balance_sender);

    // For receiver: Use homomorphic addition to update their balance
    // new_receiver_balance = old_receiver_balance + encrypt(transfer_amount, receiver_pubkey)
    // This way, sender doesn't need receiver's private key!
    let transfer_amount_ct = encrypt(receiver_pubkey_ec, transfer_amount, r_transfer_amount);
    let new_balance_receiver_ct = add_ciphertexts(old_balance_receiver_ct, transfer_amount_ct);

    // Return Point structs (serializes to individual Fields)
    // Order matches contract: receiver_new, then sender_new
    (
        Point { x: new_balance_receiver_ct.0.x, y: new_balance_receiver_ct.0.y },
        Point { x: new_balance_receiver_ct.1.x, y: new_balance_receiver_ct.1.y },
        Point { x: new_balance_sender_ct.0.x, y: new_balance_sender_ct.0.y },
        Point { x: new_balance_sender_ct.1.x, y: new_balance_sender_ct.1.y }
    )
}

// ==================== TESTS ====================

#[test]
fn test_transfer_basic() {
    // Setup: Sender with 1000 tokens transfers 300 to receiver with 500 tokens
    let sender_priv_key = 42;
    let sender_pubkey = public_key(sender_priv_key);

    // Receiver's private key is ONLY used in test to verify the result
    // The sender NEVER needs to know this!
    let receiver_priv_key = 100;
    let receiver_pubkey = public_key(receiver_priv_key);

    let sender_balance = 1000;
    let receiver_balance = 500;
    let transfer_amount = 300;

    let expected_sender_new_balance = 700;
    let expected_receiver_new_balance = 800;

    // Encrypt balances
    let r_old_sender = 111;
    let old_balance_sender_ct = encrypt(sender_pubkey, sender_balance, r_old_sender);

    let r_old_receiver = 333;
    let old_balance_receiver_ct = encrypt(receiver_pubkey, receiver_balance, r_old_receiver);

    // New randomness
    let r_new_sender = 222;
    let r_transfer = 444; // For encrypting the transfer amount under receiver's key

    // Call with Point structs
    let (recv_new_x1, recv_new_x2, send_new_x1, send_new_x2) = main(
        sender_priv_key,
        sender_balance,
        transfer_amount,
        r_new_sender,
        r_transfer,
        2, // receiver address
        Point { x: receiver_pubkey.x, y: receiver_pubkey.y },
        Point { x: old_balance_receiver_ct.0.x, y: old_balance_receiver_ct.0.y },
        Point { x: old_balance_receiver_ct.1.x, y: old_balance_receiver_ct.1.y },
        Point { x: sender_pubkey.x, y: sender_pubkey.y },
        Point { x: old_balance_sender_ct.0.x, y: old_balance_sender_ct.0.y },
        Point { x: old_balance_sender_ct.1.x, y: old_balance_sender_ct.1.y },
        3  // token address
    );

    // Reconstruct CipherText from returned Points
    let new_balance_sender_ct: CipherText = (
        EmbeddedCurvePoint { x: send_new_x1.x, y: send_new_x1.y, is_infinite: false },
        EmbeddedCurvePoint { x: send_new_x2.x, y: send_new_x2.y, is_infinite: false }
    );

    let new_balance_receiver_ct: CipherText = (
        EmbeddedCurvePoint { x: recv_new_x1.x, y: recv_new_x1.y, is_infinite: false },
        EmbeddedCurvePoint { x: recv_new_x2.x, y: recv_new_x2.y, is_infinite: false }
    );

    // Verify: sender's new balance decrypts correctly
    let decrypted_sender_new = decrypt(new_balance_sender_ct, sender_priv_key);
    verify_embedding(decrypted_sender_new, expected_sender_new_balance);

    // Verify: receiver's new balance decrypts correctly using RECEIVER'S private key
    // (which the sender never needed to know!)
    let decrypted_receiver_new = decrypt(new_balance_receiver_ct, receiver_priv_key);
    verify_embedding(decrypted_receiver_new, expected_receiver_new_balance);
}

#[test]
fn test_transfer_to_zero_balance() {
    // Setup: Transfer to user with zero balance
    let sender_priv_key = 42;
    let sender_pubkey = public_key(sender_priv_key);

    let receiver_priv_key = 100;
    let receiver_pubkey = public_key(receiver_priv_key);

    let sender_balance = 1000;
    let receiver_balance = 0; // Zero balance
    let transfer_amount = 500;

    let r_old_sender = 111;
    let old_balance_sender_ct = encrypt(sender_pubkey, sender_balance, r_old_sender);

    let r_old_receiver = 333;
    let old_balance_receiver_ct = encrypt(receiver_pubkey, receiver_balance, r_old_receiver);

    let r_new_sender = 222;
    let r_transfer = 444;

    // Call with Point structs
    let (recv_new_x1, recv_new_x2, send_new_x1, send_new_x2) = main(
        sender_priv_key,
        sender_balance,
        transfer_amount,
        r_new_sender,
        r_transfer,
        2,
        Point { x: receiver_pubkey.x, y: receiver_pubkey.y },
        Point { x: old_balance_receiver_ct.0.x, y: old_balance_receiver_ct.0.y },
        Point { x: old_balance_receiver_ct.1.x, y: old_balance_receiver_ct.1.y },
        Point { x: sender_pubkey.x, y: sender_pubkey.y },
        Point { x: old_balance_sender_ct.0.x, y: old_balance_sender_ct.0.y },
        Point { x: old_balance_sender_ct.1.x, y: old_balance_sender_ct.1.y },
        3
    );

    // Reconstruct CipherText from returned Points
    let new_balance_sender_ct: CipherText = (
        EmbeddedCurvePoint { x: send_new_x1.x, y: send_new_x1.y, is_infinite: false },
        EmbeddedCurvePoint { x: send_new_x2.x, y: send_new_x2.y, is_infinite: false }
    );

    let new_balance_receiver_ct: CipherText = (
        EmbeddedCurvePoint { x: recv_new_x1.x, y: recv_new_x1.y, is_infinite: false },
        EmbeddedCurvePoint { x: recv_new_x2.x, y: recv_new_x2.y, is_infinite: false }
    );

    let decrypted_sender_new = decrypt(new_balance_sender_ct, sender_priv_key);
    verify_embedding(decrypted_sender_new, 500);

    let decrypted_receiver_new = decrypt(new_balance_receiver_ct, receiver_priv_key);
    verify_embedding(decrypted_receiver_new, 500);
}

#[test(should_fail)]
fn test_insufficient_balance_fails() {
    // Setup: Sender with 100 tokens tries to transfer 1000
    let sender_priv_key = 42;
    let sender_pubkey = public_key(sender_priv_key);

    let receiver_priv_key = 100;
    let receiver_pubkey = public_key(receiver_priv_key);

    let sender_balance = 100;
    let receiver_balance = 500;
    let transfer_amount = 1000; // More than sender has!

    let r_old_sender = 111;
    let old_balance_sender_ct = encrypt(sender_pubkey, sender_balance, r_old_sender);

    let r_old_receiver = 333;
    let old_balance_receiver_ct = encrypt(receiver_pubkey, receiver_balance, r_old_receiver);

    let r_new_sender = 222;
    let r_transfer = 444;

    // This should fail due to insufficient balance
    let (_, _, _, _) = main(
        sender_priv_key,
        sender_balance,
        transfer_amount,
        r_new_sender,
        r_transfer,
        2,
        Point { x: receiver_pubkey.x, y: receiver_pubkey.y },
        Point { x: old_balance_receiver_ct.0.x, y: old_balance_receiver_ct.0.y },
        Point { x: old_balance_receiver_ct.1.x, y: old_balance_receiver_ct.1.y },
        Point { x: sender_pubkey.x, y: sender_pubkey.y },
        Point { x: old_balance_sender_ct.0.x, y: old_balance_sender_ct.0.y },
        Point { x: old_balance_sender_ct.1.x, y: old_balance_sender_ct.1.y },
        3
    );
}
