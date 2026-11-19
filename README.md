# Certification académique sur blockchain

Application locale de création et de vérification de certificats.

## Outils

Node.js, Hardhat, Solidity, React, Vite, ethers et SheetJS.

## Démarrage

Depuis la racine du projet, dans un premier terminal :

yarn.cmd hardhat node

Dans un deuxième terminal :

node scripts/deploy.mjs
.\node_modules\.bin\vite.cmd frontend --host 127.0.0.1

Ouvrir http://127.0.0.1:5173.

Connecter MetaMask au réseau Hardhat Local, ID 31337,
RPC http://127.0.0.1:8545, avec le compte Hardhat #0.

## Utilisation

Créer un certificat avec le formulaire.
Importer et sélectionner des lignes Excel ou CSV.
Vérifier un certificat avec son numéro dans la zone publique.

Chaque identifiant étudiant peut être utilisé une seule fois.

## Tests

Garder Hardhat actif, puis lancer :

node tests/certificates.mjs

## Adresse du contrat

L’adresse du dernier déploiement est enregistrée dans :

frontend/src/generated/address.json

## Fonctionnement hors ligne

Installer les dépendances avant la démonstration.
Conserver le dossier node_modules sur le PC de démonstration.

Après un redémarrage de Hardhat, redéployer le contrat
et actualiser l’application. Les données du nœud précédent
ne sont pas conservées par cette configuration.