/* ============================================================
   THE THRONE — AUTH
   Magic-link email sign-in (no passwords to manage or leak).
   On first sign-in, generates this device's Vault keypair and
   publishes the public half to the user's profile.
   ============================================================ */

const ThroneAuth = (() => {

  let currentUser = null;

  function setLoadingMsg(text) {
    const el = document.getElementById("loading-msg");
    if (el) el.textContent = text;
  }
  function hideLoadingScreen() {
    const el = document.getElementById("loading-screen");
    if (el) el.classList.add("hide");
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function fetchDisplayName(user) {
    const { data } = await supabaseClient
      .from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    return (data && data.display_name) || user.email.split("@")[0];
  }

  function showGate(message) {
    const gate = document.getElementById("auth-gate");
    gate.classList.add("show");
    if (message) document.getElementById("auth-gate-msg").textContent = message;
  }
  function hideGate() {
    document.getElementById("auth-gate").classList.remove("show");
  }

  function showPassphraseGate(mode, msg) {
    const gate = document.getElementById("passphrase-gate");
    const title = document.getElementById("pg-title");
    const sub = document.getElementById("pg-sub");
    const confirmInput = document.getElementById("pg-passphrase-confirm");
    const submitBtn = document.getElementById("pg-submit");

    if (mode === "create") {
      title.textContent = "Create Your Vault Key";
      sub.textContent = "This passphrase protects your private messages. There is no reset and no recovery option — if you forget it and lose access to every device that has it unlocked, your message history is gone permanently, by design. That's what real end-to-end encryption means: nobody, including you without this passphrase, can get it back. Write it down somewhere safe before continuing.";
      confirmInput.style.display = "block";
      submitBtn.textContent = "Create Vault key";
    } else {
      title.textContent = "Unlock Your Vault";
      sub.textContent = "This device doesn't have your Vault key yet. Enter your passphrase to restore it — this lets you read past messages on this device too.";
      confirmInput.style.display = "none";
      submitBtn.textContent = "Unlock Vault";
    }
    document.getElementById("pg-msg").textContent = msg || "";
    gate.classList.add("show");
    gate.dataset.mode = mode;
  }

  function hidePassphraseGate() {
    document.getElementById("passphrase-gate").classList.remove("show");
  }

  async function ensureProfile(user) {
    return new Promise(async (resolve, reject) => {
      const hasLocal = await VaultCrypto.hasLocalKeypair();

      if (hasLocal) {
        // Device already has a key — just make sure the profile's public
        // key matches (e.g. it was wiped server-side) and move on.
        const keys = await VaultCrypto.getOrCreateKeypair();
        const { data: existing } = await supabaseClient
          .from("profiles").select("public_key").eq("id", user.id).maybeSingle();
        if (!existing || existing.public_key !== keys.publicKeyBase64) {
          await supabaseClient.from("profiles")
            .update({ public_key: keys.publicKeyBase64 }).eq("id", user.id);
        }
        return resolve();
      }

      // No local key on this device — figure out if this is the FIRST
      // device ever (create a new identity) or a NEW device joining an
      // existing identity (restore from the passphrase-wrapped backup).
      const { data: profile } = await supabaseClient
        .from("profiles").select("wrapped_private_key, key_salt, key_iv").eq("id", user.id).maybeSingle();

      const mode = profile && profile.wrapped_private_key ? "restore" : "create";
      showPassphraseGate(mode);

      const submitBtn = document.getElementById("pg-submit");
      const msgEl = document.getElementById("pg-msg");

      const handler = async () => {
        const pass = document.getElementById("pg-passphrase").value;
        if (!pass || pass.length < 8) {
          msgEl.textContent = "Use at least 8 characters.";
          return;
        }

        submitBtn.disabled = true;
        try {
          if (mode === "create") {
            const confirmPass = document.getElementById("pg-passphrase-confirm").value;
            if (pass !== confirmPass) {
              msgEl.textContent = "Passphrases don't match.";
              submitBtn.disabled = false;
              return;
            }
            await VaultCrypto.getOrCreateKeypair();
            const backup = await VaultCrypto.createBackup(pass);
            await supabaseClient.from("profiles").update({
              public_key: backup.publicKeyBase64,
              wrapped_private_key: backup.wrappedPrivateKey,
              key_salt: backup.salt,
              key_iv: backup.iv
            }).eq("id", user.id);
          } else {
            await VaultCrypto.restoreFromBackup(pass, profile.wrapped_private_key, profile.key_salt, profile.key_iv);
          }
          submitBtn.removeEventListener("click", handler);
          hidePassphraseGate();
          resolve();
        } catch (e) {
          msgEl.textContent = e.message;
          submitBtn.disabled = false;
        }
      };
      submitBtn.addEventListener("click", handler);
    });
  }

  async function init(onReady) {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
      currentUser = session.user;
      const name = await fetchDisplayName(currentUser);
      setLoadingMsg(`Welcome back, ${name}.`);
      await sleep(900);
      hideLoadingScreen();
      hideGate();
      await ensureProfile(currentUser);
      onReady(currentUser);
    } else {
      hideLoadingScreen();
      showGate();
    }

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        currentUser = session.user;
        const name = await fetchDisplayName(currentUser);
        setLoadingMsg(`Welcome, ${name}.`);
        hideGate();
        await ensureProfile(currentUser);
        onReady(currentUser);
      }
      if (event === "SIGNED_OUT") {
        currentUser = null;
        showGate();
      }
    });

    document.getElementById("auth-send-link").addEventListener("click", async () => {
      const email = document.getElementById("auth-email").value.trim();
      if (!email) return;
      const btn = document.getElementById("auth-send-link");
      btn.textContent = "Sending…";
      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: {
          // Explicitly tell Supabase where THIS page actually is, rather
          // than relying only on the Site URL dashboard setting — fixes
          // magic links landing on the wrong path/subfolder.
          emailRedirectTo: window.location.origin + window.location.pathname
        }
      });
      btn.textContent = error ? "Try again" : "Check your inbox";
      if (error) showGate(error.message);
      else showGate(`Magic link sent to ${email} — open it on this device to enter.`);
    });
  }

  function signOut() {
    return supabaseClient.auth.signOut();
  }

  function getUser() {
    return currentUser;
  }

  return { init, signOut, getUser };
})();
