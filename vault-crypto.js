/* ============================================================
   THE THRONE — VAULT CRYPTO
   Real end-to-end encryption using the browser's built-in
   Web Crypto API. No custom crypto, no "quantum" marketing —
   this is ECDH (P-256) key exchange + AES-GCM message encryption,
   the same primitives Signal and most real E2E apps use.

   How it works:
   1. Each device generates its own ECDH keypair on first login.
   2. The PRIVATE key never leaves the device (stored in IndexedDB).
   3. The PUBLIC key is uploaded to your `profiles` row in Supabase
      — safe to share, that's the point of public-key crypto.
   4. To message someone, you derive a shared AES key from your
      private key + their public key (ECDH). Only the two of you
      can ever compute that shared key.
   5. Messages are encrypted with that shared AES-GCM key before
      they touch the network. Supabase only ever stores ciphertext.
   ============================================================ */

const VaultCrypto = (() => {

  const DB_NAME = "throne-vault-keys";
  const STORE_NAME = "keys";

  // ---------- local key storage (IndexedDB) ----------
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ---------- encoding helpers ----------
  function bufToBase64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  function base64ToBuf(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
  }

  // ---------- keypair lifecycle ----------
  // Returns this device's keypair, generating + persisting it on first run.
  async function getOrCreateKeypair() {
    let stored = await idbGet("keypair");
    if (stored) return stored;

    const keypair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );
    const publicKeyRaw = await crypto.subtle.exportKey("raw", keypair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey("jwk", keypair.privateKey);

    stored = {
      publicKeyBase64: bufToBase64(publicKeyRaw),
      privateKeyJwk
    };
    await idbSet("keypair", stored);
    return stored;
  }

  async function hasLocalKeypair() {
    return !!(await idbGet("keypair"));
  }

  // ---------- passphrase-based backup (multi-device support) ----------
  // Problem this solves: without it, every new device generates its OWN
  // keypair, so it can never decrypt conversations older devices had.
  // Fix: wrap the private key with a passphrase-derived AES key and store
  // the wrapped blob in Supabase. Any device that knows the passphrase
  // can restore the exact same identity instead of creating a new one.

  function base64UrlToBuf(b64url) {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(b64url.length + (4 - b64url.length % 4) % 4, "=");
    return base64ToBuf(b64);
  }

  // EC private JWKs include x/y (the public point) alongside d (the private
  // scalar) — so we can rebuild the raw public key straight from the JWK
  // without needing a second stored value.
  function publicKeyBase64FromPrivateJwk(jwk) {
    const x = new Uint8Array(base64UrlToBuf(jwk.x));
    const y = new Uint8Array(base64UrlToBuf(jwk.y));
    const point = new Uint8Array(1 + x.length + y.length);
    point[0] = 0x04; // uncompressed EC point marker
    point.set(x, 1);
    point.set(y, 1 + x.length);
    return bufToBase64(point.buffer);
  }

  async function deriveWrappingKey(passphrase, saltBuf) {
    const baseKey = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltBuf, iterations: 210000, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // Wraps THIS device's current private key for upload to Supabase.
  async function createBackup(passphrase) {
    const stored = await idbGet("keypair");
    if (!stored) throw new Error("No local keypair to back up yet.");

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrappingKey = await deriveWrappingKey(passphrase, salt);

    const plaintext = new TextEncoder().encode(JSON.stringify(stored.privateKeyJwk));
    const wrappedBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrappingKey, plaintext);

    return {
      wrappedPrivateKey: bufToBase64(wrappedBuf),
      salt: bufToBase64(salt.buffer),
      iv: bufToBase64(iv.buffer),
      publicKeyBase64: stored.publicKeyBase64
    };
  }

  // Restores a keypair on a NEW device from the wrapped backup + passphrase.
  // On success, this device can now decrypt every past conversation.
  async function restoreFromBackup(passphrase, wrappedPrivateKeyBase64, saltBase64, ivBase64) {
    const salt = new Uint8Array(base64ToBuf(saltBase64));
    const iv = new Uint8Array(base64ToBuf(ivBase64));
    const wrappingKey = await deriveWrappingKey(passphrase, salt);

    let plaintextBuf;
    try {
      plaintextBuf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv }, wrappingKey, base64ToBuf(wrappedPrivateKeyBase64)
      );
    } catch (e) {
      throw new Error("Wrong passphrase — couldn't unlock the Vault key.");
    }

    const privateKeyJwk = JSON.parse(new TextDecoder().decode(plaintextBuf));
    const publicKeyBase64 = publicKeyBase64FromPrivateJwk(privateKeyJwk);

    const stored = { publicKeyBase64, privateKeyJwk };
    await idbSet("keypair", stored);
    return stored;
  }

  async function importOwnPrivateKey() {
    const stored = await idbGet("keypair");
    if (!stored) throw new Error("No local keypair yet — call getOrCreateKeypair() first.");
    return crypto.subtle.importKey(
      "jwk", stored.privateKeyJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false, ["deriveKey", "deriveBits"]
    );
  }

  async function importRemotePublicKey(publicKeyBase64) {
    const raw = base64ToBuf(publicKeyBase64);
    return crypto.subtle.importKey(
      "raw", raw,
      { name: "ECDH", namedCurve: "P-256" },
      false, []
    );
  }

  // ---------- shared secret derivation ----------
  // IMPORTANT — what changed here and why, and what this does NOT do:
  //
  // The original design derived ONE static AES-GCM key per conversation
  // (straight from ECDH(myPrivate, theirPublic)) and reused it for every
  // message, forever. That's a real gap versus what "end-to-end
  // encrypted" implies today: if either person's private key is ever
  // compromised, every message they've ever exchanged — past and future
  // — becomes readable with that one key.
  //
  // What this version does instead: derive a per-CONVERSATION root
  // secret via ECDH (same as before), but never use it directly to
  // encrypt. Each message instead gets its own one-time AES-GCM key,
  // derived from the root secret + a random salt via HKDF (salt travels
  // with the ciphertext, same as the IV already does — it's not secret,
  // it's what makes each derived key unique). This is real, meaningful
  // security hygiene: no single key ever encrypts more than one message,
  // which is good AES-GCM practice regardless, and bounds what a single
  // recovered message key can expose to that one message.
  //
  // What this is NOT: real forward secrecy (à la Signal's Double
  // Ratchet). True forward secrecy needs state that both sides advance
  // and can never wind backward — and this app's multi-device design
  // (the SAME private key restored via passphrase onto every device,
  // by design, so any device can read your full history) is
  // fundamentally incompatible with that without a real redesign: any
  // ratcheting state would need to somehow stay in sync across every
  // device sharing one identity, which Signal itself avoids by giving
  // every DEVICE its own separate identity and session instead of
  // sharing one static key. Retrofitting that safely is a genuine
  // architecture change, not something to bolt on in one pass — so
  // this ships the real, bounded improvement now, and leaves true
  // forward secrecy as a scoped future project if that's ever wanted.
  //
  // Backward compatible: any message stored before this change has no
  // salt, and decryptMessage() below still reads those correctly via
  // the untouched legacy path — nothing in your existing history
  // becomes unreadable.
  async function deriveRootSecretBits(theirPublicKeyBase64) {
    const myPrivateKey = await importOwnPrivateKey();
    const theirPublicKey = await importRemotePublicKey(theirPublicKeyBase64);
    return crypto.subtle.deriveBits({ name: "ECDH", public: theirPublicKey }, myPrivateKey, 256);
  }

  async function deriveMessageKey(rootSecretBits, saltBuf) {
    const hkdfBaseKey = await crypto.subtle.importKey("raw", rootSecretBits, "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: saltBuf, info: new TextEncoder().encode("throne-vault-message-key") },
      hkdfBaseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // Legacy path — reproduces the original static per-conversation key
  // exactly, so messages encrypted before this change still decrypt.
  async function deriveSharedKeyLegacy(theirPublicKeyBase64) {
    const myPrivateKey = await importOwnPrivateKey();
    const theirPublicKey = await importRemotePublicKey(theirPublicKeyBase64);
    return crypto.subtle.deriveKey(
      { name: "ECDH", public: theirPublicKey },
      myPrivateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // ---------- message encrypt/decrypt ----------
  async function encryptMessage(plaintext, theirPublicKeyBase64) {
    const rootBits = await deriveRootSecretBits(theirPublicKeyBase64);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const messageKey = await deriveMessageKey(rootBits, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertextBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, messageKey, encoded
    );
    return {
      ciphertext: bufToBase64(ciphertextBuf),
      iv: bufToBase64(iv),
      salt: bufToBase64(salt.buffer)
    };
  }

  async function decryptMessage(ciphertextBase64, ivBase64, theirPublicKeyBase64, saltBase64) {
    const iv = new Uint8Array(base64ToBuf(ivBase64));
    const ciphertextBuf = base64ToBuf(ciphertextBase64);

    const key = saltBase64
      ? await deriveMessageKey(await deriveRootSecretBits(theirPublicKeyBase64), new Uint8Array(base64ToBuf(saltBase64)))
      : await deriveSharedKeyLegacy(theirPublicKeyBase64); // pre-upgrade message, no salt stored

    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertextBuf);
    return new TextDecoder().decode(plainBuf);
  }

  return {
    getOrCreateKeypair, hasLocalKeypair,
    createBackup, restoreFromBackup,
    encryptMessage, decryptMessage
  };
})();
