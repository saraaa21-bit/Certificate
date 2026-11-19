import fs from "node:fs";
import { JsonRpcProvider, ContractFactory } from "ethers";
import { abi, bytecode } from "./compile.mjs";

const provider = new JsonRpcProvider("http://127.0.0.1:8545");

try {
  const network = await provider.getNetwork();

  if (network.chainId !== 31337n) {
    throw new Error("Selectionne Hardhat Local, identifiant 31337.");
  }

  const signer = await provider.getSigner(0);

  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();

  fs.writeFileSync(
    "frontend/src/generated/address.json",
    JSON.stringify({ address }, null, 2)
  );

  console.log("Adresse du contrat :", address);
  console.log("Proprietaire :", await contract.owner());
} finally {
  provider.destroy();
}