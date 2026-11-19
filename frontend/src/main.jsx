import React, { useState } from "react";
import { createRoot } from "react-dom/client";

import {
  BrowserProvider,
  JsonRpcProvider,
  Contract,
  ZeroAddress,
  isAddress
} from "ethers";

import * as XLSX from "xlsx";

import abi from "./generated/abi.json";
import configuration from "./generated/address.json";
import "./style.css";

const rpc = new JsonRpcProvider("http://127.0.0.1:8545");
const registry = new Contract(configuration.address, abi, rpc);

const fields = [
  ["studentName", "Nom complet"],
  ["studentId", "Identifiant étudiant"],
  ["diplomaTitle", "Diplôme"],
  ["issueDate", "Date d'émission"],
  ["recipientAddress", "Adresse wallet facultative"],
  ["grade", "Mention"]
];

const emptyForm = {
  studentName: "",
  studentId: "",
  diplomaTitle: "",
  issueDate: "",
  recipientAddress: "",
  grade: ""
};

function errorMessage(error) {
  return error.reason || error.shortMessage || error.message;
}

function validate(record) {
  if (
    !record.studentName ||
    !record.studentId ||
    !record.diplomaTitle ||
    !record.issueDate
  ) {
    return "Nom, identifiant, diplôme et date obligatoires.";
  }

  const date = new Date(record.issueDate + "T00:00:00Z");

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(record.issueDate) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== record.issueDate
  ) {
    return "Date invalide. Utilisez AAAA-MM-JJ.";
  }

  if (record.recipientAddress && !isAddress(record.recipientAddress)) {
    return "Adresse Ethereum invalide.";
  }

  return "";
}

function App() {
  const [account, setAccount] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [busy, setBusy] = useState(false);

  const [certId, setCertId] = useState("");
  const [certificate, setCertificate] = useState(null);
  const [searchMessage, setSearchMessage] = useState("");

  async function connect() {
    try {
      if (!window.ethereum) {
        throw new Error("Ouvrez cette page avec MetaMask.");
      }

      await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      setAccount(await signer.getAddress());
      setMessage("Wallet connecté.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function writableContract() {
    if (!window.ethereum) {
      throw new Error("MetaMask introuvable.");
    }

    const chainId = await window.ethereum.request({
      method: "eth_chainId"
    });

    if (BigInt(chainId) !== 31337n) {
      throw new Error("Choisissez Hardhat Local (31337) pour ce site.");
    }

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    setAccount(address);

    const code = await provider.getCode(configuration.address);

    if (code === "0x") {
      throw new Error("Contrat absent. Relancez le script de déploiement.");
    }

    const contract = new Contract(configuration.address, abi, signer);
    const owner = await contract.owner();

    if (owner.toLowerCase() !== address.toLowerCase()) {
      throw new Error("Connectez le compte Hardhat #0, propriétaire du contrat.");
    }

    return contract;
  }

  async function mint(contract, record) {
    const transaction = await contract.mintCertificate(
      record.recipientAddress || ZeroAddress,
      record.studentName,
      record.studentId,
      record.diplomaTitle,
      record.issueDate,
      record.grade
    );

    setTransactions(list => [
      { hash: transaction.hash, status: "En attente" },
      ...list
    ]);

    try {
      await transaction.wait();

      setTransactions(list =>
        list.map(item =>
          item.hash === transaction.hash
            ? { ...item, status: "Confirmée" }
            : item
        )
      );
    } catch (error) {
      setTransactions(list =>
        list.map(item =>
          item.hash === transaction.hash
            ? { ...item, status: "À vérifier" }
            : item
        )
      );

      throw error;
    }
  }

  async function issueOne(event) {
    event.preventDefault();
    setBusy(true);

    try {
      const record = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, value.trim()])
      );

      const error = validate(record);
      if (error) throw new Error(error);

      const contract = await writableContract();

      setMessage("Confirmez l'émission dans MetaMask.");
      await mint(contract, record);

      setMessage("Certificat émis avec succès.");
      setForm(emptyForm);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function importFile(event) {
    const file = event.target.files[0];
    event.target.value = "";

    if (!file) return;

    setRows([]);
    setBusy(true);

    try {
      if (!/\.(xlsx|csv)$/i.test(file.name)) {
        throw new Error("Choisissez un fichier .xlsx ou .csv.");
      }

      const workbook = XLSX.read(await file.arrayBuffer(), {
        cellDates: true,
        raw: true
      });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        blankrows: false
      });

      const [header = [], ...lines] = data;
      const columns = header.map(value =>
        String(value).trim().replace(/^\uFEFF/, "")
      );

      for (const key of [
        "studentName",
        "studentId",
        "diplomaTitle",
        "issueDate"
      ]) {
        if (!columns.includes(key)) {
          throw new Error("Colonne manquante : " + key);
        }
      }

      if (!lines.length) throw new Error("Le fichier est vide.");

      const usedIds = new Set();

      const imported = lines.map((line, index) => {
        const record = {};

        for (const [key] of fields) {
          const value = line[columns.indexOf(key)] ?? "";

          record[key] = value instanceof Date
            ? value.toISOString().slice(0, 10)
            : String(value).trim();
        }

        let error = validate(record);

        if (!error && usedIds.has(record.studentId)) {
          error = "Identifiant en double dans le fichier.";
        }

        if (!error) usedIds.add(record.studentId);

        return {
          index,
          record,
          error,
          selected: !error,
          issued: false
        };
      });

      setRows(imported);
      setMessage("Vérifiez les lignes avant de les émettre.");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function issueSelected() {
    setBusy(true);
    let count = 0;

    try {
      const selected = rows.filter(row => row.selected && !row.issued);

      if (!selected.length) {
        throw new Error("Sélectionnez au moins une ligne.");
      }

      for (const row of selected) {
        const contract = await writableContract();

        setMessage("Confirmez le certificat de " + row.record.studentName);
        await mint(contract, row.record);

        setRows(list =>
          list.map(item =>
            item.index === row.index
              ? { ...item, issued: true, selected: false }
              : item
          )
        );

        count++;
      }

      setMessage(count + " certificat(s) émis.");
    } catch (error) {
      setMessage(
        count + " certificat(s) confirmé(s). " + errorMessage(error)
      );
    } finally {
      setBusy(false);
    }
  }

  async function search(event) {
    event.preventDefault();
    setCertificate(null);
    setSearchMessage("Recherche...");

    try {
      const id = certId.trim();

      if (!/^\d+$/.test(id) || BigInt(id) < 1n) {
        throw new Error("Saisissez un numéro entier supérieur à zéro.");
      }

      const result = await registry.getCertificate(id);

      setCertificate(result);
      setSearchMessage("");
    } catch (error) {
      setSearchMessage(errorMessage(error));
    }
  }

  return (
    <main>
      <h1>Certification académique</h1>
      <p>Réseau Hardhat Local</p>

      <section>
        <h2>Administration</h2>

        <button disabled={busy} onClick={connect}>
          Connecter MetaMask
        </button>

        <p>Compte : {account || "Non connecté"}</p>

        <h3>Émettre un certificat</h3>

        <form onSubmit={issueOne}>
          <fieldset disabled={busy}>
            {fields.map(([key, label]) => (
              <label key={key}>
                {label}

                <input
                  type={key === "issueDate" ? "date" : "text"}
                  value={form[key]}
                  onChange={event =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                />
              </label>
            ))}
          </fieldset>

          <button disabled={busy || !account}>Émettre</button>
        </form>

        <h3>Importer Excel ou CSV</h3>

        <input
          type="file"
          accept=".xlsx,.csv"
          disabled={busy}
          onChange={importFile}
        />

        {rows.length > 0 && (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Choix</th>
                    {fields.map(([key, label]) => (
                      <th key={key}>{label}</th>
                    ))}
                    <th>État</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map(row => (
                    <tr key={row.index}>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.selected}
                          disabled={busy || row.issued || !!row.error}
                          onChange={event => {
                            const selected = event.target.checked;

                            setRows(list =>
                              list.map(item =>
                                item.index === row.index
                                  ? { ...item, selected }
                                  : item
                              )
                            );
                          }}
                        />
                      </td>

                      {fields.map(([key]) => (
                        <td key={key}>{row.record[key]}</td>
                      ))}

                      <td>
                        {row.issued ? "Émis" : row.error || "Prêt"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              disabled={busy || !account}
              onClick={issueSelected}
            >
              Émettre les lignes sélectionnées
            </button>
          </>
        )}

        <p role="status">{message}</p>

        <h3>Transactions</h3>

        {transactions.map(transaction => (
          <p className="hash" key={transaction.hash}>
            {transaction.status} — {transaction.hash}
          </p>
        ))}
      </section>

      <section>
        <h2>Vérification publique</h2>

        <form onSubmit={search}>
          <label>
            Numéro du certificat
            <input
              value={certId}
              onChange={event => setCertId(event.target.value)}
              placeholder="Exemple : 1"
            />
          </label>

          <button>Vérifier</button>
        </form>

        <p role="status">{searchMessage}</p>

        {certificate && (
          <div>
            <p>Nom : {certificate.studentName}</p>
            <p>Identifiant étudiant : {certificate.studentId}</p>
            <p>Diplôme : {certificate.diplomaTitle}</p>
            <p>Date : {certificate.issueDate}</p>
            <p>Mention : {certificate.grade}</p>
            <p className="hash">Destinataire : {certificate.recipient}</p>
            <p>Statut : {certificate.revoked ? "Révoqué" : "Valide"}</p>
          </div>
        )}
      </section>

      <p className="hash">Contrat : {configuration.address}</p>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);