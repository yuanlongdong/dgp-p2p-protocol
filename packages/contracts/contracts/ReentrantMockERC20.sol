// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ReentrantMockERC20
 * @notice ERC20 test token that can attempt a single reentrant callback during transfer/transferFrom.
 * @dev Used only for attack simulation tests.
 */
contract ReentrantMockERC20 is ERC20 {
    address public hookTarget;
    bytes public hookData;
    bool public hookEnabled;
    bool private inHook;
    bool public lastHookCallSuccess;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function configureHook(address target, bytes calldata data, bool enabled) external {
        hookTarget = target;
        hookData = data;
        hookEnabled = enabled;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        _tryHook();
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        _tryHook();
        return super.transferFrom(from, to, value);
    }

    function _tryHook() internal {
        if (!hookEnabled || inHook || hookTarget == address(0)) {
            return;
        }

        inHook = true;
        (bool ok, ) = hookTarget.call(hookData);
        lastHookCallSuccess = ok;
        inHook = false;
    }
}
