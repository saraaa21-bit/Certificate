import assert from "node:assert/strict";
import { JsonRpcProvider, ContractFactory, ZeroAddress } from "ethers";

import { abi, bytecode } from "../scripts/compile.mjs";

const provider = new JsonRpcProvider("http://127.0.0.1:8545");

try {
  const owner = await provider.getSigner(0);
  const otherAccount = await provider.getSigner(1);

  const factory = new ContractFactory(abi, bytecode, owner);
  const contract = await factory.deploy();

  await contract.waitForDeployment();

  const values = [
    ZeroAddress,
    "Etudiant Test",
    "TEST-001",
    "Licence Informatique",
    "2026-06-15",
    "Bien"
  ];

  const transaction = await contract.mintCertificate(...values);
  const receipt = await transaction.wait();

  assert.equal(await contract.totalCertificates(), 1n);

  const certificate = await contract.getCertificate(1);

  assert.equal(certificate.studentName, "Etudiant Test");
  assert.equal(certificate.studentId, "TEST-001");
  assert.equal(certificate.revoked, false);

  const event = contract.interface.parseLog(receipt.logs[0]);

  assert.equal(event.name, "CertificateMinted");
  assert.equal(event.args.certId, 1n);

  await assert.rejects(
    contract.mintCertificate.staticCall(...values)
  );

  await assert.rejects(
    contract.connect(otherAccount).mintCertificate.staticCall(...values)
  );

  await assert.rejects(
    contract.getCertificate(999)
  );

  console.log("Tous les tests sont réussis.");
} finally {
  provider.destroy();
}