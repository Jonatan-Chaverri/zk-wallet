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
// Simple Wallet: Deposit (receive) and Withdraw (send)
// methodTag: 2=deposit, 3=withdraw

fn main(
    // Private
    current_balance: Field,
    operation_amount: Field,  // deposit/withdraw amount
    r_old_balance: Field,
    r_new_balance: Field,

    // Public
    sender_pubkey: pub EmbeddedCurvePoint,
    old_balance_x1: pub EmbeddedCurvePoint,
    old_balance_x2: pub EmbeddedCurvePoint,
    from: pub Field,
    to: pub Field,
    token: pub Field,
    chainId: pub Field,
    methodTag: pub Field,  // 2=deposit, 3=withdraw
) -> pub (
    (EmbeddedCurvePoint, EmbeddedCurvePoint),  // new_balance_ct
    Field  // revealed_amount (for deposit/withdraw)
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

    // DEPOSIT (methodTag == 2) - Receive money
    if methodTag == 2 {
        // Add to balance
        new_balance = current_balance + operation_amount;
        new_balance.assert_max_bit_size::<40>();
        revealed_amount = operation_amount;  // Reveal amount for contract
    }

    // WITHDRAW (methodTag == 3) - Send money (to any address)
    if methodTag == 3 {
        // Subtract from balance (underflow check via subtraction)
        new_balance = current_balance - operation_amount;
        new_balance.assert_max_bit_size::<40>();
        revealed_amount = operation_amount;  // Reveal amount for contract
    }

    // Encrypt new balance
    let new_balance_ct = encrypt(sender_pubkey, new_balance, r_new_balance);

    (
        (new_balance_ct.0, new_balance_ct.1),
        revealed_amount
    )
}

// ==================== TESTS ====================

#[test]
fn test_deposit() {
    let priv_key = 42;
    let pub_key = public_key(priv_key);

    let old_balance_ct = encrypt(pub_key, 500, 111);

    let (new_ct, amt) = main(
        500, 300, 111, 222,
        pub_key, old_balance_ct.0, old_balance_ct.1,
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

    let old_balance_ct = encrypt(pub_key, 1000, 111);

    let (new_ct, amt) = main(
        1000, 250, 111, 222,
        pub_key, old_balance_ct.0, old_balance_ct.1,
        1, 2, 3, 4, 3  // methodTag=3 (withdraw)
    );

    let new_balance = decrypt((new_ct.0, new_ct.1), priv_key);
    verify_embedding(new_balance, 750);
    assert(amt == 250);  // Amount revealed for withdraw
}

#[test(should_fail)]
fn test_insufficient_balance_fails() {
    let sender_pub = public_key(42);
    let old_balance_ct = encrypt(sender_pub, 100, 111);

    let _ = main(
        100, 200, 111, 222,
        sender_pub, old_balance_ct.0, old_balance_ct.1,
        1, 2, 3, 4, 3  // Withdraw more than balance - should fail
    );
}
