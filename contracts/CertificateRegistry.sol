// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract CertificateRegistry {
    struct Certificate {
        string studentName;
        string studentId;
        string diplomaTitle;
        string issueDate;
        string grade;
        address recipient;
        bool revoked;
    }

    address public owner;
    uint256 public totalCertificates;

    mapping(uint256 => Certificate) private certificates;
    mapping(string => bool) private studentIdUsed;

    event CertificateMinted(
        uint256 indexed certId,
        address indexed recipient,
        string studentId
    );

    constructor() {
        owner = msg.sender;
    }

    function mintCertificate(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade
    ) external returns (uint256 certId) {
        require(msg.sender == owner, "Compte non autorise");
        require(bytes(studentName).length > 0, "Nom obligatoire");
        require(bytes(studentId).length > 0, "Identifiant obligatoire");
        require(bytes(diplomaTitle).length > 0, "Diplome obligatoire");
        require(bytes(issueDate).length > 0, "Date obligatoire");
        require(!studentIdUsed[studentId], "Identifiant deja utilise");

        totalCertificates++;
        certId = totalCertificates;

        certificates[certId] = Certificate(
            studentName,
            studentId,
            diplomaTitle,
            issueDate,
            grade,
            to,
            false
        );

        studentIdUsed[studentId] = true;

        emit CertificateMinted(certId, to, studentId);
    }

    function getCertificate(uint256 certId)
        external
        view
        returns (Certificate memory)
    {
        require(
            certId > 0 && certId <= totalCertificates,
            "Certificat introuvable"
        );

        return certificates[certId];
    }
}