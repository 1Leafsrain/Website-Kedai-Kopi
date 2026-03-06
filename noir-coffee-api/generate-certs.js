/**
 * generate-certs.js
 * Generates a self-signed SSL certificate for local HTTPS development.
 * Run once: node generate-certs.js
 */
const selfsigned = require("selfsigned");
const fs = require("fs");
const path = require("path");

const CERTS_DIR = path.join(__dirname, "certs");

if (!fs.existsSync(CERTS_DIR)) {
    fs.mkdirSync(CERTS_DIR, { recursive: true });
}

const attrs = [
    { name: "commonName", value: "localhost" },
    { name: "organizationName", value: "Noir Coffee Dev" },
    { name: "countryName", value: "ID" },
];

const opts = {
    days: 365,
    algorithm: "sha256",
    extensions: [
        {
            name: "subjectAltName",
            altNames: [
                { type: 2, value: "localhost" },
                { type: 7, ip: "127.0.0.1" },
            ],
        },
    ],
};

(async () => {
    console.log("Generating self-signed SSL certificate...");
    const pems = await selfsigned.generate(attrs, opts);
    fs.writeFileSync(path.join(CERTS_DIR, "key.pem"), pems.private);
    fs.writeFileSync(path.join(CERTS_DIR, "cert.pem"), pems.cert);
    console.log("Certificates generated:");
    console.log("   certs/key.pem  - private key");
    console.log("   certs/cert.pem - self-signed certificate");
    console.log("\nBrowser will show a security warning on first visit.");
    console.log("Open https://localhost:3443 in browser and click Advanced -> Proceed to trust the cert.");
})();
