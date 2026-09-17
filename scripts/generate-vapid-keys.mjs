#!/usr/bin/env node
// One-time VAPID keypair generator for Web Push (see src/lib/push.ts).
// Standard P-256 keys, base64url-encoded the same way `npx web-push
// generate-vapid-keys` or any other VAPID generator would -- nothing here
// is specific to this app, just self-contained so generating a pair
// doesn't require installing a separate CLI.
//
// Run with: npm run vapid:generate

import { webcrypto } from "node:crypto";

function toBase64Url(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const keyPair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);

const publicKeyRaw = await webcrypto.subtle.exportKey("raw", keyPair.publicKey);
// JWK's "d" field for an EC private key is already base64url-encoded per
// spec -- exactly the format VAPID private keys use, no re-encoding needed.
const privateKeyJwk = await webcrypto.subtle.exportKey("jwk", keyPair.privateKey);

console.log(`VAPID_PUBLIC_KEY=${toBase64Url(publicKeyRaw)}`);
console.log(`VAPID_PRIVATE_KEY=${privateKeyJwk.d}`);
