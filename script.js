const { ethers, upgrades} = require("hardhat");

async function main() {

    const proxyAddress = "0x37313a6a7107a8361654b9EF81591c698e0B8Ff0";

    const Staking = await ethers.getContractFactory("CZT_Staking2");
    const staking = await upgrades.upgradeProxy(proxyAddress, Staking, {
        kind: "uups",
        unsafeAllow: ["state-variable-immutable", "constructor"]
    });
    await staking.waitForDeployment();

    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Proxy address:          ", proxyAddress);
    console.log("New implementation:     ", implementationAddress);

}
main().catch(console.error)
