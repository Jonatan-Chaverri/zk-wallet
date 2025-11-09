use elgamal::{add_ciphertexts, CipherText, encrypt, decrypt, public_key, verify_embedding, embed_message};
use std::embedded_curve_ops::EmbeddedCurvePoint;

// Helper: Create a zero/default point
fn zero_point() -> EmbeddedCurvePoint {
    EmbeddedCurvePoint { x: 0, y: 0, is_infinite: true }
}

// Helper: Create a zero ciphertext
fn zero_ciphertext() -> CipherText {
    (zero_point(), zero_point())
}

// Helper: Negate a point for subtraction
fn negate_point(p: EmbeddedCurvePoint) -> EmbeddedCurvePoint {
    EmbeddedCurvePoint { x: p.x, y: -p.y, is_infinite: p.is_infinite }
}

// Helper: Subtract ciphertexts (homomorphic subtraction)
// Only works when both ciphertexts use the SAME public key!
fn subtract_ciphertexts(a: CipherText, b: CipherText) -> CipherText {
    let neg_b = (negate_point(b.0), negate_point(b.1));
    add_ciphertexts(a, neg_b)
}

// ==================== MAIN CIRCUIT ====================
// Confidential Wallet: Deposit, Withdraw, Transfer
// method_tag: 1=transfer, 2=deposit, 3=withdraw

fn main(
    // Private inputs (secrets not revealed in proof)
    sender_priv_key: Field,
    current_balance_sender: Field,      // sender's plaintext balance
    operation_amount: Field,             // amount to deposit/withdraw/transfer
    r_new_balance_sender: Field,         // randomness for new sender balance encryption
    r_transfer_amount: Field,            // randomness for encrypting transfer amount (for receiver)

    // Public inputs (visible in proof)
    sender_address: pub Field,
    sender_pubkey: pub EmbeddedCurvePoint,
    old_balance_sender_ct: pub CipherText,  // encrypted balance from contract

    receiver_address: pub Field,
    receiver_pubkey: pub EmbeddedCurvePoint,
    old_balance_receiver_ct: pub CipherText,

    token: pub Field,
    method_tag: pub Field,  // 1=transfer, 2=deposit, 3=withdraw
) -> pub (
    CipherText,  // new_balance_sender_ct
    CipherText,  // new_balance_receiver_ct (zero for deposit/withdraw)
    Field        // revealed_amount (for deposit/withdraw, zero for transfer)
) {
    // Enforce 40-bit range constraints to prevent overflow
    current_balance_sender.assert_max_bit_size::<40>();
    operation_amount.assert_max_bit_size::<40>();

    // Verify sender's public key matches their private key
    let computed_sender_pubkey = public_key(sender_priv_key);
    assert(computed_sender_pubkey == sender_pubkey);

    // Verify sender knows the decryption of their old balance
    let decrypted_old_balance_sender = decrypt(old_balance_sender_ct, sender_priv_key);
    verify_embedding(decrypted_old_balance_sender, current_balance_sender);

    // Initialize outputs
    let mut new_balance_sender_ct: CipherText = zero_ciphertext();
    let mut new_balance_receiver_ct: CipherText = zero_ciphertext();
    let mut revealed_amount: Field = 0;

    // ==================== TRANSFER (method_tag = 1) ====================
    if method_tag == 1 {
        // Verify sender has sufficient balance (cast to u64 for comparison)
        let balance_u64 = current_balance_sender as u64;
        let amount_u64 = operation_amount as u64;
        assert(balance_u64 >= amount_u64);

        // Calculate new sender balance
        let new_balance_sender = current_balance_sender - operation_amount;
        new_balance_sender.assert_max_bit_size::<40>();

        // Encrypt new sender balance
        new_balance_sender_ct = encrypt(sender_pubkey, new_balance_sender, r_new_balance_sender);

        // For receiver: Use homomorphic addition to update their balance
        // new_receiver_balance = old_receiver_balance + encrypt(transfer_amount, receiver_pubkey)
        // This way, sender doesn't need receiver's private key!
        let transfer_amount_ct = encrypt(receiver_pubkey, operation_amount, r_transfer_amount);
        new_balance_receiver_ct = add_ciphertexts(old_balance_receiver_ct, transfer_amount_ct);

        // The receiver can decrypt their new balance later using their own private key
        // No need to verify receiver's private key here!

        revealed_amount = 0; // Transfer amounts stay private
    }
    // ==================== DEPOSIT (method_tag = 2) ====================
    else if method_tag == 2 {
        // Calculate new balance after deposit
        let new_balance_sender = current_balance_sender + operation_amount;
        new_balance_sender.assert_max_bit_size::<40>();

        // Encrypt new balance
        new_balance_sender_ct = encrypt(sender_pubkey, new_balance_sender, r_new_balance_sender);

        // Reveal the deposit amount (contract needs to custody tokens)
        revealed_amount = operation_amount;

        // Receiver fields unused for deposits (set to zero)
        new_balance_receiver_ct = zero_ciphertext();
    }
    // ==================== WITHDRAW (method_tag = 3) ====================
    else if method_tag == 3 {
        // Verify sender has sufficient balance (cast to u64 for comparison)
        let balance_u64 = current_balance_sender as u64;
        let amount_u64 = operation_amount as u64;
        assert(balance_u64 >= amount_u64);

        // Calculate new balance after withdrawal
        let new_balance_sender = current_balance_sender - operation_amount;
        new_balance_sender.assert_max_bit_size::<40>();

        // Encrypt new balance
        new_balance_sender_ct = encrypt(sender_pubkey, new_balance_sender, r_new_balance_sender);

        // Reveal the withdrawal amount (contract needs to release tokens)
        revealed_amount = operation_amount;

        // Receiver fields unused for withdrawals (set to zero)
        new_balance_receiver_ct = zero_ciphertext();
    } else {
        // Invalid method_tag
        assert(false);
    }

    (new_balance_sender_ct, new_balance_receiver_ct, revealed_amount)
}

// ==================== TESTS ====================

#[test]
fn test_deposit() {
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

    // Unused for deposits
    let receiver_pubkey = zero_point();
    let old_balance_receiver_ct = zero_ciphertext();

    let (new_balance_ct, _, revealed_amount) = main(
        sender_priv_key,
        current_balance,
        deposit_amount,
        r_new,
        0, // r_transfer_amount unused
        1, // sender address
        sender_pubkey,
        old_balance_ct,
        2, // receiver address (unused)
        receiver_pubkey,
        old_balance_receiver_ct,
        3, // token address
        2  // method_tag = 2 (deposit)
    );

    // Verify: revealed amount should be the deposit
    assert(revealed_amount == deposit_amount);

    // Verify: new balance decrypts correctly
    let decrypted_new_balance = decrypt(new_balance_ct, sender_priv_key);
    verify_embedding(decrypted_new_balance, expected_new_balance);
}

#[test]
fn test_withdraw() {
    // Setup: User with 1000 tokens wants to withdraw 200
    let sender_priv_key = 42;
    let sender_pubkey = public_key(sender_priv_key);

    let current_balance = 1000;
    let withdraw_amount = 200;
    let expected_new_balance = 800;

    // Encrypt current balance
    let r_old = 111;
    let old_balance_ct = encrypt(sender_pubkey, current_balance, r_old);

    // New randomness for new balance
    let r_new = 222;

    // Unused for withdrawals
    let receiver_pubkey = zero_point();
    let old_balance_receiver_ct = zero_ciphertext();

    let (new_balance_ct, _, revealed_amount) = main(
        sender_priv_key,
        current_balance,
        withdraw_amount,
        r_new,
        0, // r_transfer_amount unused
        1, // sender address
        sender_pubkey,
        old_balance_ct,
        2, // receiver address (unused)
        receiver_pubkey,
        old_balance_receiver_ct,
        3, // token address
        3  // method_tag = 3 (withdraw)
    );

    // Verify: revealed amount should be the withdrawal
    assert(revealed_amount == withdraw_amount);

    // Verify: new balance decrypts correctly
    let decrypted_new_balance = decrypt(new_balance_ct, sender_priv_key);
    verify_embedding(decrypted_new_balance, expected_new_balance);
}

#[test]
fn test_transfer() {
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

    let (new_balance_sender_ct, new_balance_receiver_ct, revealed_amount) = main(
        sender_priv_key,
        sender_balance,
        transfer_amount,
        r_new_sender,
        r_transfer, // Randomness for encrypting transfer for receiver
        1, // sender address
        sender_pubkey,
        old_balance_sender_ct,
        2, // receiver address
        receiver_pubkey,
        old_balance_receiver_ct,
        3, // token address
        1  // method_tag = 1 (transfer)
    );

    // Verify: amount should NOT be revealed for transfers
    assert(revealed_amount == 0);

    // Verify: sender's new balance decrypts correctly
    let decrypted_sender_new = decrypt(new_balance_sender_ct, sender_priv_key);
    verify_embedding(decrypted_sender_new, expected_sender_new_balance);

    // Verify: receiver's new balance decrypts correctly using RECEIVER'S private key
    // (which the sender never needed to know!)
    let decrypted_receiver_new = decrypt(new_balance_receiver_ct, receiver_priv_key);
    verify_embedding(decrypted_receiver_new, expected_receiver_new_balance);
}

#[test(should_fail)]
fn test_insufficient_balance_withdraw() {
    // Setup: User with 100 tokens tries to withdraw 1000
    let sender_priv_key = 42;
    let sender_pubkey = public_key(sender_priv_key);

    let current_balance = 100;
    let withdraw_amount = 1000; // More than balance!

    // Encrypt current balance
    let r_old = 111;
    let old_balance_ct = encrypt(sender_pubkey, current_balance, r_old);

    let r_new = 222;

    let receiver_pubkey = zero_point();
    let old_balance_receiver_ct = zero_ciphertext();

    // This should fail due to insufficient balance
    let (_, _, _) = main(
        sender_priv_key,
        current_balance,
        withdraw_amount,
        r_new,
        0, // r_transfer_amount
        1,
        sender_pubkey,
        old_balance_ct,
        2,
        receiver_pubkey,
        old_balance_receiver_ct,
        3,
        3  // withdraw
    );
}

#[test(should_fail)]
fn test_insufficient_balance_transfer() {
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
    let (_, _, _) = main(
        sender_priv_key,
        sender_balance,
        transfer_amount,
        r_new_sender,
        r_transfer,
        1,
        sender_pubkey,
        old_balance_sender_ct,
        2,
        receiver_pubkey,
        old_balance_receiver_ct,
        3,
        1  // transfer
    );
}
