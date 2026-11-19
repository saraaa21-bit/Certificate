import fs from "node:fs";
import solc from "solc";

const source = fs.readFileSync(
  "contracts/CertificateRegistry.sol",
  "utf8"
);

const input = {
  language: "Solidity",
  sources: {
    "CertificateRegistry.sol": { content: source }
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"]
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

const errors = (output.errors || []).filter(
  error => error.severity === "error"
);

if (errors.length > 0) {
  throw new Error(
    errors.map(error => error.formattedMessage).join("\n")
  );
}

const result =
  output.contracts["CertificateRegistry.sol"].CertificateRegistry;

export const abi = result.abi;
export const bytecode = "0x" + result.evm.bytecode.object;

fs.mkdirSync("frontend/src/generated", { recursive: true });

fs.writeFileSync(
  "frontend/src/generated/abi.json",
  JSON.stringify(abi, null, 2)
);