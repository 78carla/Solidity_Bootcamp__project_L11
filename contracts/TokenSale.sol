// contracts/MyERC20.sol
//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

import "./MyERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
interface IMyToken is IERC20{
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
    
}
interface IMyNFT {
    function safeMint (address to, uint256 tokenId) external;
    function burn (uint256 tokenId) external;
        
    }
contract TokenSale is Ownable {
    
    uint256 public ratio;
    uint256 public price;
    IMyToken public tokenAddress;
    IMyNFT public nftAddress;
    uint256 public withdrawableAmount;
    constructor (uint256 _ratio, address _tokenAddress, uint256 _price, address _nftAddress)  {
        ratio = _ratio; 
        tokenAddress = IMyToken(_tokenAddress);
        price = _price;
        nftAddress = IMyNFT(_nftAddress);
    }  

    function buyTokens() public payable {
        tokenAddress.mint(msg.sender, msg.value * ratio);
    } 

    function burnTokens (uint256 amount) external {
        tokenAddress.burnFrom(msg.sender, amount);
        payable(msg.sender).transfer(amount / ratio);
        
    }

    function buyNFT (uint256 tokenId) external {
        //Charge the payment
        tokenAddress.transferFrom(msg.sender, address(this), price);
        
        //mint the NFT
        //send the NFT to the buyer
        nftAddress.safeMint(msg.sender, tokenId);
        
        //account the amount the owner can withdraw
        withdrawableAmount += price/2;     
    }

    function burnNFT (uint256 tokenId) external {
      
        nftAddress.burn(tokenId);
        tokenAddress.transfer(msg.sender, price - price/2);
    }

    function withdraw(uint256 amount) external onlyOwner {
        withdrawableAmount -= amount;
        tokenAddress.transfer(owner(), amount);
    }
}