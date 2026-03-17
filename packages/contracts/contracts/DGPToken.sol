// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DGPToken is ERC20, Ownable {
uint256 public immutable maxSupply;

constructor(address initialOwner, uint256 maxSupply_) ERC20("DGP Token", "DGP") Ownable(initialOwner) {
require(maxSupply_ > 0, "max-supply=0");
maxSupply = maxSupply_;
}

function mint(address to, uint256 amount) external onlyOwner {
require(totalSupply() + amount <= maxSupply, "cap-exceeded");
_mint(to, amount);
}
}
