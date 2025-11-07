use super::*;
use stylus_sdk::testing::*;
use stylus_sdk::alloy_primitives::{address, U256, FixedBytes};

// helper to make dummy address
fn addr(n: u8) -> Address {
    let mut bytes = [0u8; 20];
    bytes[19] = n;
    Address::from(bytes)
}

#[test]
fn test_init_sets_owner_and_conf_erc20() {
    let vm = TestVM::default();
    let mut wallet = UserWallet::from(&vm);

    let owner = Address::from([1u8; 20]);
    let conf_erc20 = Address::from([2u8; 20]);

    wallet.init(owner, conf_erc20).unwrap();

    assert_eq!(wallet.get_owner(), owner);
    assert_eq!(wallet.get_confidential_erc20(), conf_erc20);
    assert_eq!(wallet.get_nonce(), U256::ZERO);
}

#[test]
fn test_only_owner_can_set_owner() {
    let vm = TestVM::default();
    let mut wallet = UserWallet::from(&vm);

    let owner = Address::from([1u8; 20]);
    wallet.init(owner, Address::ZERO).unwrap();

    // ✅ Allowed
    vm.set_sender(owner);
    wallet.set_owner(Address::from([9u8; 20])).unwrap();

    // ❌ Forbidden
    vm.set_sender(Address::from([3u8; 20]));
    let err = wallet.set_owner(Address::from([5u8; 20])).unwrap_err();
    assert!(String::from_utf8_lossy(&err).contains("Not owner"));
}

#[test]
fn test_set_audit_pubkey_and_get() {
    let vm = TestVM::default();
    let mut wallet = UserWallet::from(&vm);

    let owner = Address::from([1u8; 20]);
    wallet.init(owner, Address::ZERO).unwrap();

    vm.set_sender(owner);
    let pk = FixedBytes::<32>::from([0xAA; 32]);
    wallet.set_audit_pubkey(pk).unwrap();

    assert_eq!(wallet.get_audit_pubkey(), pk);
}

#[test]
fn test_withdraw_private_reverts_for_non_owner() {
    let vm = TestVM::default();
    let mut wallet = UserWallet::from(&vm);

    let owner = Address::from([1u8; 20]);
    wallet.init(owner, Address::ZERO).unwrap();

    vm.set_sender(Address::from([99u8; 20]));

    let err = wallet
        .withdraw_private(
            Address::from([4u8; 20]),
            Address::from([5u8; 20]),
            FixedBytes::<32>::ZERO,
            FixedBytes::<32>::ZERO,
            FixedBytes::<32>::ZERO,
            FixedBytes::<32>::ZERO,
        )
        .unwrap_err();

    assert!(String::from_utf8_lossy(&err).contains("Not owner"));
}
