use elgamal::{CipherText, encrypt, public_key, decrypt, verify_embedding};
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

// ==================== DEPOSIT CIRCUIT ====================
// Allows users to deposit tokens into their confidential balance
//
// PUBLIC INPUTS/OUTPUTS BYTE LAYOUT (matching Rust contract):
// [0..64]:     sender_pubkey (x: 32, y: 32)
// [64..192]:   old_balance_ct (x1.x: 32, x1.y: 32, x2.x: 32, x2.y: 32)
// [192..320]:  new_balance_ct (x1.x: 32, x1.y: 32, x2.x: 32, x2.y: 32) - OUTPUT
// [320..352]:  sender_address (32)
// [352..384]:  token (32)
// [384..416]:  revealed_amount (32) - OUTPUT
// Total: 416 bytes

fn main(
    // Private inputs (secrets not revealed in proof)
    sender_priv_key: Field,
    current_balance: Field,        // Current plaintext balance
    deposit_amount: Field,          // Amount to deposit
    r_new_balance: Field,           // Randomness for new balance encryption

    // Public inputs (visible in proof) - ORDER MATTERS for contract!
    sender_pubkey: pub Point,
    old_balance_x1: pub Point,
    old_balance_x2: pub Point,
    sender_address: pub Field,
    token: pub Field
) -> pub (
    Point,  // new_balance_x1
    Point,  // new_balance_x2
    Field   // revealed_amount
) {
    // Reconstruct EmbeddedCurvePoint and CipherText from Point structs
    let sender_pubkey_ec = EmbeddedCurvePoint {
        x: sender_pubkey.x,
        y: sender_pubkey.y,
        is_infinite: false
    };

    let old_balance_ct: CipherText = (
        EmbeddedCurvePoint { x: old_balance_x1.x, y: old_balance_x1.y, is_infinite: false },
        EmbeddedCurvePoint { x: old_balance_x2.x, y: old_balance_x2.y, is_infinite: false }
    );

    // Enforce range constraints
    deposit_amount.assert_max_bit_size::<40>();

    // Verify sender authentication and balance knowledge
    verify_sender(sender_priv_key, sender_pubkey_ec, old_balance_ct, current_balance);

    // Calculate new balance after deposit
    let new_balance = current_balance + deposit_amount;
    new_balance.assert_max_bit_size::<40>();

    // Encrypt new balance
    let new_balance_ct = encrypt(sender_pubkey_ec, new_balance, r_new_balance);

    // Return Point structs (serializes to individual Fields)
    (
        Point { x: new_balance_ct.0.x, y: new_balance_ct.0.y },
        Point { x: new_balance_ct.1.x, y: new_balance_ct.1.y },
        deposit_amount
    )
}

// ==================== TESTS ====================

#[test]
fn test_deposit_basic() {
    // Setup: User with 500 tokens wants to deposit 300 more
    let sender_priv_key = 42;
    let sender_pubkey = public_key(sender_priv_key);

    let current_balance = 500;
    let deposit_amount = 300;
    let expected_new_balance = 800;

    // Encrypt current balance
    let r_old = 111;
    let old_balance_ct = encrypt(sender_pubkey, current_balance, r_old);

    // New randomness for new balance
    let r_new = 222;

    // Call with Point structs
    let (new_bal_x1, new_bal_x2, revealed_amount) = main(
        sender_priv_key,
        current_balance,
        deposit_amount,
        r_new,
        Point { x: sender_pubkey.x, y: sender_pubkey.y },
        Point { x: old_balance_ct.0.x, y: old_balance_ct.0.y },
        Point { x: old_balance_ct.1.x, y: old_balance_ct.1.y },
        1, // sender address
        3  // token address
    );

    // Verify: revealed amount should be the deposit
    assert(revealed_amount == deposit_amount);

    // Reconstruct CipherText from returned Points
    let new_balance_ct: CipherText = (
        EmbeddedCurvePoint { x: new_bal_x1.x, y: new_bal_x1.y, is_infinite: false },
        EmbeddedCurvePoint { x: new_bal_x2.x, y: new_bal_x2.y, is_infinite: false }
    );

    // Verify: new balance decrypts correctly
    let decrypted_new_balance = decrypt(new_balance_ct, sender_priv_key);
    verify_embedding(decrypted_new_balance, expected_new_balance);
}

#[test]
fn test_deposit_zero_balance() {
    // Setup: New user with 0 balance deposits 1000
    let sender_priv_key = 42;
    let sender_pubkey = public_key(sender_priv_key);

    let current_balance = 0;
    let deposit_amount = 1000;

    let r_old = 111;
    let old_balance_ct = encrypt(sender_pubkey, current_balance, r_old);

    let r_new = 222;

    // Call with Point structs
    let (new_bal_x1, new_bal_x2, revealed_amount) = main(
        sender_priv_key,
        current_balance,
        deposit_amount,
        r_new,
        Point { x: sender_pubkey.x, y: sender_pubkey.y },
        Point { x: old_balance_ct.0.x, y: old_balance_ct.0.y },
        Point { x: old_balance_ct.1.x, y: old_balance_ct.1.y },
        1,
        3
    );

    assert(revealed_amount == deposit_amount);

    // Reconstruct CipherText from returned Points
    let new_balance_ct: CipherText = (
        EmbeddedCurvePoint { x: new_bal_x1.x, y: new_bal_x1.y, is_infinite: false },
        EmbeddedCurvePoint { x: new_bal_x2.x, y: new_bal_x2.y, is_infinite: false }
    );

    let decrypted_new_balance = decrypt(new_balance_ct, sender_priv_key);
    verify_embedding(decrypted_new_balance, deposit_amount);
}
