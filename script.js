const { ethers, upgrades} = require("hardhat");

async function main() {

    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    const tokenAddress = "0x93857A2c3F2a54b94CE4433C46677E3E9aD8798C";
    const devWallet = "0x7703895D67AeBef27a4E3270f0AA984D3bBba1A2";
    
    const Staking = await ethers.getContractFactory("CZT_Staking");
    const staking = await upgrades.deployProxy(Staking, [tokenAddress, devWallet],
        {initializer: "initialize",
            kind: "uups",
            unsafeAllow: ["state-variable-immutable", "constructor"]
        }
    );
    await staking.waitForDeployment();
    const stakingAddress = await staking.getAddress();
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(stakingAddress);
    console.log("\nStaking address:  ", stakingAddress);
    console.log("Implementation Address: ",implementationAddress);

}
main().catch(console.error)
