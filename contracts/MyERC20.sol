// contracts/MyERC20.sol
//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
contract MyToken is ERC20, AccessControl, ERC20Burnable{

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    constructor () ERC20 ("MyERC20", "MTK") { 
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE){
        _mint(to, amount);
    }
    
}


