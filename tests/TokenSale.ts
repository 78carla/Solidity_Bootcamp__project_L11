import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import exp from "constants";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
  MyToken,
  MyToken__factory,
  TokenSale,
  TokenSale__factory,
  MyNFT,
  MyNFT__factory,
} from "../typechain-types";
import { token } from "../typechain-types/@openzeppelin/contracts";

const TEST_TOKEN_RATIO = 1;
const TEST_TOKEN_MINT = ethers.utils.parseEther("1");

const TEST_TOKEN_PRICE = ethers.utils.parseEther("0.002");
const TEST_NFT_ID = 42;

describe("NFT Shop", async () => {
  let tokenSaleContract: TokenSale;
  let tokenContract: MyToken;
  let deployer: SignerWithAddress;
  let account1: SignerWithAddress;
  let account2: SignerWithAddress;
  let NFTContract: MyNFT;

  beforeEach(async () => {
    [deployer, account1, account2] = await ethers.getSigners();

    const tokenContractFactory = new MyToken__factory(deployer);
    tokenContract = await tokenContractFactory.deploy();
    await tokenContract.deployTransaction.wait();

    const NFTContractFactory = new MyNFT__factory(deployer);
    NFTContract = await NFTContractFactory.deploy();
    await NFTContract.deployTransaction.wait();

    const contractFactory = new TokenSale__factory(deployer);
    tokenSaleContract = await contractFactory.deploy(
      TEST_TOKEN_RATIO,
      tokenContract.address,
      TEST_TOKEN_PRICE,
      NFTContract.address
    );
    await tokenSaleContract.deployTransaction.wait();

    const mintRole = await tokenContract.MINTER_ROLE();
    const giveTokenMintRoleTx = await tokenContract.grantRole(
      mintRole,
      tokenSaleContract.address
    );
    await giveTokenMintRoleTx.wait();

    const giveNFTMintRoleTx = await NFTContract.grantRole(
      mintRole,
      tokenSaleContract.address
    );
    await giveNFTMintRoleTx.wait();
  });

  describe("When the Shop contract is deployed", async () => {
    it("defines the ratio as provided in parameters", async () => {
      const radio = await tokenSaleContract.ratio();
      expect(radio).to.equal(TEST_TOKEN_RATIO);
      console.log("The token contract address is: ", tokenContract.address);
    });

    it("uses a valid ERC20 as payment token", async () => {
      const tokenAddress = await tokenSaleContract.tokenAddress();
      expect(tokenAddress).to.not.be.null;
      const tokenContractFactory = new MyToken__factory(deployer);
      const tokenUsedInContract = tokenContractFactory.attach(tokenAddress);
      await expect(tokenUsedInContract.totalSupply()).to.not.be.reverted;
      await expect(tokenUsedInContract.balanceOf(account1.address)).to.not.be
        .reverted;
      await expect(
        tokenUsedInContract.transfer(account1.address, 1)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    describe("When a user purchase an ERC20 from the Token contract", async () => {
      let tokenBalanceBeforeMint: BigNumber;
      let ethBalanceBeforeMint: BigNumber;
      let mintTxGasCost: BigNumber;

      beforeEach(async () => {
        tokenBalanceBeforeMint = await tokenContract.balanceOf(
          account1.address
        );
        ethBalanceBeforeMint = await account1.getBalance();
        const buyTokensTx = await tokenSaleContract
          .connect(account1)
          .buyTokens({ value: TEST_TOKEN_MINT });
        const byTokensTxReceipt = await buyTokensTx.wait();
        mintTxGasCost = byTokensTxReceipt.gasUsed.mul(
          byTokensTxReceipt.effectiveGasPrice
        );
      });

      it("charges the correct amount of ETH", async () => {
        const ethBalanceAfterMint = await account1.getBalance();
        const expectd = TEST_TOKEN_MINT.add(mintTxGasCost);
        const diff = ethBalanceBeforeMint.sub(ethBalanceAfterMint);
        const error = diff.sub(expectd);
        expect(error).to.eq(0);
      });

      it("gives the correct amount of tokens", async () => {
        const tokenBalanceAfterMint = await tokenContract.balanceOf(
          account1.address
        );
        expect(tokenBalanceAfterMint.sub(tokenBalanceBeforeMint)).to.eq(
          TEST_TOKEN_MINT.mul(TEST_TOKEN_RATIO)
        );
      });
    });

    describe("When a user burns an ERC20 at the Shop contract", async () => {
      let tokenBalanceBeforeBurn: BigNumber;
      let burnAmount: BigNumber;
      let ethBalanceBeforeBurn: BigNumber;
      let allowTxGasCost: BigNumber;
      let burnTxGasCost: BigNumber;

      beforeEach(async () => {
        ethBalanceBeforeBurn = await tokenContract.balanceOf(account1.address);
        tokenBalanceBeforeBurn = await tokenContract.balanceOf(
          account1.address
        );
        burnAmount = tokenBalanceBeforeBurn.div(2);

        const allowTx = await tokenContract
          .connect(account1)
          .approve(tokenSaleContract.address, burnAmount);
        const allowTxReceipt = await allowTx.wait();

        allowTxGasCost = allowTxReceipt.gasUsed.mul(
          allowTxReceipt.effectiveGasPrice
        );

        const burnTx = await tokenSaleContract
          .connect(account1)
          .burnTokens(burnAmount);
        await burnTx.wait();
        const burnTxReceipt = await burnTx.wait();

        burnTxGasCost = burnTxReceipt.gasUsed.mul(
          burnTxReceipt.effectiveGasPrice
        );
      });

      it("gives the correct amount of ETH", async () => {
        const ethBalanceAfterBurn = await account1.getBalance();
        const diff = ethBalanceAfterBurn.sub(ethBalanceBeforeBurn);
        const costs = allowTxGasCost.add(burnTxGasCost);
        expect(diff).to.eq(burnAmount.div(TEST_TOKEN_RATIO).sub(costs));
      });

      it("burns the correct amount of tokens", async () => {
        const tokenBalanceAfterBurn = await tokenContract.balanceOf(
          account1.address
        );
        console.log(tokenBalanceAfterBurn);
        console.log(tokenBalanceAfterBurn);

        const diff = tokenBalanceBeforeBurn.sub(tokenBalanceAfterBurn);
        expect(diff).to.eq(burnAmount);
      });
    });
  });
  describe("When a user purchase a NFT from the Shop contract", async () => {
    let tokenBalanceBeforeBuyNFT: BigNumber;

    beforeEach(async () => {
      tokenBalanceBeforeBuyNFT = await tokenContract.balanceOf(
        account1.address
      );

      const allowTx = await tokenContract
        .connect(account1)
        .approve(tokenSaleContract.address, TEST_TOKEN_PRICE);
      await allowTx.wait();

      const buyTx = await tokenSaleContract
        .connect(account1)
        .buyNFT(TEST_NFT_ID);
      await buyTx.wait();
    });

    it("charges the correct amount of ERC20 tokens", async () => {
      const tokenBalanceAfterBuyNFT = await tokenContract.balanceOf(
        account1.address
      );

      const diff = tokenBalanceBeforeBuyNFT.sub(tokenBalanceAfterBuyNFT);
      expect(diff).to.eq(TEST_TOKEN_PRICE);
    });

    it("gives the correct nft", async () => {
      const nftOwner = await NFTContract.ownerOf(TEST_NFT_ID);
      expect(nftOwner).to.eq(account1.address);
    });

    it("updates the owner pool account correctly", async () => {
      const withrableAmount = await tokenSaleContract.withdrawableAmount();
      expect(withrableAmount).to.eq(TEST_TOKEN_PRICE.div(2));
    });

    //it("update the public pool account correctly", async () => {
    //throw new Error("Not implemented");
    //});

    //it("favors the public pool with the rounding", async () => {
    //throw new Error("Not implemented");
    //});
  });

  //describe("When a user burns their NFT at the Shop contract", async () => {
  it("gives the correct amount of ERC20 tokens", async () => {
    throw new Error("Not implemented");
  });
  it("updates the public pool correctly", async () => {
    throw new Error("Not implemented");
  });
  //});

  //describe("When the owner withdraw from the Shop contract", async () => {
  //it("recovers the right amount of ERC20 tokens", async () => {
  //throw new Error("Not implemented");
  //});
  //it("updates the owner pool account correctly", async () => {
  //throw new Error("Not implemented");
  //});
  //});
});
