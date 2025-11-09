pragma solidity >=0.8.21;

interface IVerifier {
    function verify(bytes calldata _proof, bytes32[] calldata _publicInputs)
        external
        returns (bool);

    function setForceFail(bool _fail) external;
}

contract UltraVerifier is IVerifier {
    bool public forceFail;

    function setForceFail(bool _fail) external {
        forceFail = _fail;
    }

    function verify(bytes calldata, bytes32[] calldata)
        public
        view
        override
        returns (bool)
    {
        return !forceFail;
    }
}
