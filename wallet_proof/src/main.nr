use elgamal::{add_ciphertexts, CipherText, encrypt, decrypt, public_key, verify_embedding};
use std::embedded_curve_ops::EmbeddedCurvePoint;

// Helper: Negate a point
fn negate_point(p: EmbeddedCurvePoint) -> EmbeddedCurvePoint {
    EmbeddedCurvePoint { x: p.x, y: -p.y, is_infinite: p.is_infinite }
}

// Helper: Subtract ciphertexts (homomorphic)
fn subtract_ciphertexts(a: CipherText, b: CipherText) -> CipherText {
    let neg_b = (negate_point(b.0), negate_point(b.1));
    add_ciphertexts(a, neg_b)
}

// ==================== MAIN CIRCUIT ====================
// Confidential Wallet: Transfer, Deposit, Withdraw
// methodTag: 1=transfer (encrypted->encrypted), 2=deposit, 3=withdraw

fn main(
    // Private
    current_balance: Field,
    operation_amount: Field,  // deposit/withdraw/transfer amount
    r_old_balance: Field,
    r_new_balance: Field,
    r_transfer_recipient: Field,  // Only used for transfer (methodTag=1)

    // Public
    sender_pubkey: pub EmbeddedCurvePoint,
    old_balance_x1: pub EmbeddedCurvePoint,
    old_balance_x2: pub EmbeddedCurvePoint,
    recipient_pubkey: pub EmbeddedCurvePoint,  // Only used for transfer (methodTag=1)
    from: pub Field,
    to: pub Field,
    token: pub Field,
    chainId: pub Field,
    methodTag: pub Field,  // 1=transfer, 2=deposit, 3=withdraw
) -> pub (
    (EmbeddedCurvePoint, EmbeddedCurvePoint),  // sender_new_balance_ct
    (EmbeddedCurvePoint, EmbeddedCurvePoint),  // recipient_new_balance_ct (or zero for deposit/withdraw)
    Field  // revealed_amount (for deposit/withdraw, zero for transfer)
) {
    // Range constraints
    current_balance.assert_max_bit_size::<40>();
    operation_amount.assert_max_bit_size::<40>();

    // Verify old balance encryption
    let old_balance_ct = (old_balance_x1, old_balance_x2);
    let computed_old_balance = encrypt(sender_pubkey, current_balance, r_old_balance);
    assert(computed_old_balance == old_balance_ct);

    let mut new_balance = current_balance;
    let mut revealed_amount = 0;

    // Zero point for secondary ciphertext (used when not transfer)
    let zero_point = EmbeddedCurvePoint { x: 0, y: 0, is_infinite: false };
    let mut secondary_ct = (zero_point, zero_point);

    // TRANSFER (methodTag == 1) - Private transfer (encrypted -> encrypted)
    if methodTag == 1 {
        // Subtract from sender's balance
        new_balance = current_balance - operation_amount;
        new_balance.assert_max_bit_size::<40>();

        // Encrypt transfer amount for recipient (keeps both sides private)
        let transfer_ct = encrypt(recipient_pubkey, operation_amount, r_transfer_recipient);
        secondary_ct = (transfer_ct.0, transfer_ct.1);

        // Don't reveal amount (stays encrypted)
        revealed_amount = 0;
    }

    // DEPOSIT (methodTag == 2) - Receive money
    if methodTag == 2 {
        // Add to balance
        new_balance = current_balance + operation_amount;
        new_balance.assert_max_bit_size::<40>();
        revealed_amount = operation_amount;  // Reveal amount for contract
    }

    // WITHDRAW (methodTag == 3) - Send money (to any address, becomes plain)
    if methodTag == 3 {
        // Subtract from balance (underflow check via subtraction)
        new_balance = current_balance - operation_amount;
        new_balance.assert_max_bit_size::<40>();
        revealed_amount = operation_amount;  // Reveal amount for contract
    }

    // Encrypt new balance
    let new_balance_ct = encrypt(sender_pubkey, new_balance, r_new_balance);

    (
        (new_balance_ct.0, new_balance_ct.1),  // Sender's new balance
        (secondary_ct.0, secondary_ct.1),       // Recipient's transfer ciphertext (or zeros)
        revealed_amount                         // Amount (or zero for transfer)
    )
}

// ==================== TESTS ====================

#[test]
fn test_transfer() {
    let sender_priv = 42;
    let sender_pub = public_key(sender_priv);
    let recipient_priv = 100;
    let recipient_pub = public_key(recipient_priv);

    let old_balance_ct = encrypt(sender_pub, 1000, 111);

    let (sender_new_ct, recipient_ct, amt) = main(
        1000, 100, 111, 222, 333,  // transfer 100 from 1000
        sender_pub, old_balance_ct.0, old_balance_ct.1,
        recipient_pub,
        1, 2, 3, 4, 1  // methodTag=1 (transfer)
    );

    // Sender's new balance should be 900 (encrypted)
    let sender_new = decrypt((sender_new_ct.0, sender_new_ct.1), sender_priv);
    verify_embedding(sender_new, 900);

    // Recipient gets encrypted transfer amount (100)
    let recipient_amount = decrypt((recipient_ct.0, recipient_ct.1), recipient_priv);
    verify_embedding(recipient_amount, 100);

    // Amount should NOT be revealed (stays private)
    assert(amt == 0);
}

#[test]
fn test_deposit() {
    let priv_key = 42;
    let pub_key = public_key(priv_key);
    let dummy_recipient_pub = public_key(100);  // Not used for deposit

    let old_balance_ct = encrypt(pub_key, 500, 111);

    let (new_ct, secondary_ct, amt) = main(
        500, 300, 111, 222, 0,  // r_transfer_recipient=0 (not used)
        pub_key, old_balance_ct.0, old_balance_ct.1,
        dummy_recipient_pub,  // Not used for deposit
        1, 2, 3, 4, 2  // methodTag=2 (deposit)
    );

    let new_balance = decrypt((new_ct.0, new_ct.1), priv_key);
    verify_embedding(new_balance, 800);
    assert(amt == 300);  // Deposit amount revealed
}

#[test]
fn test_withdraw() {
    let priv_key = 42;
    let pub_key = public_key(priv_key);
    let dummy_recipient_pub = public_key(100);  // Not used for withdraw

    let old_balance_ct = encrypt(pub_key, 1000, 111);

    let (new_ct, secondary_ct, amt) = main(
        1000, 250, 111, 222, 0,  // r_transfer_recipient=0 (not used)
        pub_key, old_balance_ct.0, old_balance_ct.1,
        dummy_recipient_pub,  // Not used for withdraw
        1, 2, 3, 4, 3  // methodTag=3 (withdraw)
    );

    let new_balance = decrypt((new_ct.0, new_ct.1), priv_key);
    verify_embedding(new_balance, 750);
    assert(amt == 250);  // Amount revealed for withdraw
}

#[test(should_fail)]
fn test_insufficient_balance_fails() {
    let sender_pub = public_key(42);
    let dummy_recipient_pub = public_key(100);
    let old_balance_ct = encrypt(sender_pub, 100, 111);

    let _ = main(
        100, 200, 111, 222, 0,
        sender_pub, old_balance_ct.0, old_balance_ct.1,
        dummy_recipient_pub,
        1, 2, 3, 4, 3  // Withdraw more than balance - should fail
    );
}
