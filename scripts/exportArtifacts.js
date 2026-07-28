// exportArtifacts.js — writes proxy address + ABI to frontend/lib/contract.json
// Called automatically at the end of deploy.js
// The frontend reads from this file so there is no manual copy-paste after deploys

const fs   = require("fs");
const path = require("path");

async function exportArtifacts(hre, proxyAddress) {
  const artifact = await hre.artifacts.readArtifact("Lottery");

  const output = {
    address: proxyAddress,
    abi: artifact.abi,
  };

  const outPath = path.resolve(__dirname, "../frontend/lib/contract.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n  Artifacts exported to frontend/lib/contract.json`);
}

module.exports = exportArtifacts;
