// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title WalletFactory for zkWallet (Stylus)
/// @notice Deploys Stylus-based UserWallet contracts deterministically via CREATE2
/// @dev This factory does NOT use proxies or delegatecalls.
///      Each wallet is a full Stylus contract deployed via CREATE2.
interface IUserWallet {
    function init(address owner, address confErc20) external;
}

interface IStylusDeployer {
    function deploy(
        bytes calldata bytecode,
        bytes calldata initData,
        uint256 initValue,
        bytes32 salt
    ) external payable returns (address);
}

contract WalletFactory {
    address public immutable deployer = 0xcEcba2F1DC234f70Dd89F2041029807F8D03A990;
    /// @notice Address of the ConfidentialERC20 contract used by all wallets
    address public immutable confErc20;
    error InvalidWasm();

    /// @notice Emitted when a new wallet is deployed
    event WalletDeployed(address indexed wallet, address indexed owner, bytes32 salt);

    constructor(address _confErc20) {
        confErc20 = _confErc20;
    }

    function deployWallet(bytes32 salt, address walletOwner, bytes calldata wasm) 
        external 
        returns (address wallet) 
    {
        bytes memory initData = abi.encodeWithSelector(
            IUserWallet.init.selector,
            walletOwner,
            confErc20
        );

        // Deploy WASM contract via Stylus system deployer
        wallet = IStylusDeployer(deployer).deploy(wasm, initData, 0, salt);

        emit WalletDeployed(wallet, walletOwner, salt);
    }

    /// @notice Predict the deterministic address of a wallet before deploying it
    /// @param salt The salt to be used for deployment
    /// @param walletBytecode The same bytecode that will be used for CREATE2
    /// @return predicted The address the wallet will be deployed at
    function predictWalletAddress(bytes32 salt, bytes memory walletBytecode)
        external
        view
        returns (address predicted)
    {
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(walletBytecode))
        );
        predicted = address(uint160(uint256(hash)));
    }

    /// @notice Allow the factory to receive ETH if needed
    receive() external payable {}
}
