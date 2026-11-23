# Draft backup — batch-38 (2026-11-23) — INSERTED via connector
# slug: how-to-set-up-passkeys
# title: How to Set Up Passkeys: The Complete 2026 Guide
# category: How-To (f13dd7e4-5861-4210-96a7-a03dcfc78dd9)
# meta_title: How to Set Up Passkeys: Complete Guide (2026)
# meta_description: How to set up passkeys on iPhone, Android, Windows and your password manager - with recovery setup first, a migration order, and the scams to avoid.

<p>Passkeys are no longer the future of sign-in - they are the default. Roughly 7 billion passkeys are in use worldwide, and Microsoft is retiring SMS two-factor authentication in work accounts by February 2027. If you have been meaning to switch, this is the practical guide: how to set up passkeys on every device, the order to migrate your accounts in, and the recovery step most people skip and later regret.</p>

<h2>Start with recovery, not with the passkey</h2>
<p>The biggest real-world passkey failures are not cryptographic - they are recovery failures. A 2026 academic audit of 208 passkey deployments found 66% let users register a new passkey without any extra confirmation, and no site passed every WebAuthn security check. Before you create a single passkey, know the answers to two questions: <strong>what happens if I lose this device?</strong> and <strong>who can add a new passkey to my account?</strong> The setup steps below include the recovery piece on purpose. Skipping it is how people lock themselves out.</p>

<h2>iPhone and iPad</h2>
<p>Apple stores passkeys in the <strong>Passwords app</strong> (introduced in iOS 18), with encrypted sync and recovery handled by iCloud Keychain underneath. Setup is nearly nothing to do: passkeys are on by default. When a site offers 'passkey' in its security settings, choose it, confirm with Face ID or Touch ID, and the passkey is created and synced across your Apple devices automatically. Check two settings before you rely on it:</p>
<ul>
<li>iCloud Keychain sync is on (Settings &gt; [your name] &gt; iCloud &gt; Passwords), so a lost iPhone does not mean lost passkeys.</li>
<li>You have a device passcode and a second trusted device or a recovery contact - that is your safety net.</li>
</ul>

<h2>Android and Google</h2>
<p>Google Password Manager stores and syncs passkeys across Android and Chrome. The flow is the same: at a site's security settings, choose the passkey option and confirm with your screen lock. Passkeys sync to every Android device signed into your Google account and to Chrome on desktop. As with Apple, your Google account recovery (phone, backup email, recovery code) IS the passkey recovery story - review it first.</p>

<h2>Windows</h2>
<p>Windows Hello is the built-in passkey: PIN, fingerprint, or face verification stored on the device. In November 2026 Windows 11 also gained native passkey-provider support, and Bitwarden's desktop app can now act as a system-level passkey provider - its vault unlocks with Windows Hello or macOS Touch ID and stores passkeys that sync across devices. Practical setup for most people:</p>
<ol>
<li>Sign in to the site's security settings, choose 'create a passkey'.</li>
<li>Windows offers 'Windows Hello' (device-bound) or a synced provider (your password manager) - pick the synced option if you use multiple machines.</li>
<li>Confirm with your PIN or biometric. Done.</li>
</ol>

<h2>Password managers: the cross-platform option</h2>
<p>If you live across ecosystems (Windows at work, iPhone in your pocket), a password manager is the sane place to keep passkeys:</p>
<ul>
<li><strong>1Password</strong> offers passkeys automatically whenever a login item has one (browser extension 8.12.42+), and announced post-quantum-safe passkey work in October 2026.</li>
<li><strong>Bitwarden</strong> stores and syncs passkeys, and since November 2026 integrates with Windows Hello and Touch ID at the operating-system level.</li>
<li><strong>Dashlane</strong> reports passkey authentications by its users nearly doubled year over year, to about 2.5 million per month.</li>
</ul>
<p>Whatever you choose, the manager's own master password and recovery kit matter more than ever - the vault now guards your passkeys too.</p>

<h2>The order to migrate accounts in</h2>
<p>Do not boil the ocean. Migrate in this order, one account per sitting:</p>
<ol>
<li><strong>Your email</strong> - it is the recovery key to everything else. (This is also why <a href='/articles/how-to-spot-fake-passkey-setup-scams-before-they-steal-your-account'>passkey-setup phishing</a> targets email first.)</li>
<li><strong>Your password manager and phone account</strong> (Apple ID / Google account).</li>
<li><strong>Banking and payments.</strong></li>
<li><strong>Social and everything else</strong> - whenever you next log in, spend the extra ten seconds.</li>
</ol>

<h2>What if a site does not support passkeys?</h2>
<p>Then keep a strong unique password and use <strong>TOTP codes</strong> (any authenticator app - <a href='/articles/how-totp-works'>how TOTP works</a>) instead of SMS. Microsoft's own playbook is exactly this hierarchy: passkey first, TOTP as the fallback for what passkeys cannot yet cover. TOTP is not phishing-resistant, but it beats SMS decisively - see <a href='/articles/is-sms-2fa-safe-in-2026-what-it-protects-where-it-fails-and-what-to-use-instead'>what to use instead of SMS 2FA</a>.</p>

<h2>Common mistakes to avoid</h2>
<ul>
<li><strong>Registering passkeys on only one device</strong> with no synced provider. Lose the device, lose the account.</li>
<li><strong>Ignoring recovery.</strong> Set the backup email/phone/recovery code first; a passkey without recovery is a single point of failure.</li>
<li><strong>Approving 'add a new passkey' prompts you did not start.</strong> If someone tricks you into enrolling <em>their</em> passkey, their sign-in is legitimate forever. Treat passkey enrollment like adding a new key to your house.</li>
<li><strong>Assuming passkey = immune to fraud.</strong> Fraud moves to account recovery and session hijacking - strong sign-in is necessary, not sufficient.</li>
</ul>
<p>For how the underlying standard differs from the older FIDO2 hardware-key world, see <a href='/articles/fido2-vs-passkeys'>FIDO2 vs passkeys</a>. And if Microsoft's SMS retirement is what brought you here, our <a href='/articles/microsoft-sms-2fa-retirement-what-to-do'>SMS 2FA retirement guide</a> covers the deadlines.</p>

<h2>FAQ</h2>

<h3>Are passkeys really better than passwords?</h3>
<p>For sign-in, yes: passkeys are phishing-resistant, unguessable, and never typed, and industry data shows a 93% sign-in success rate versus 78% for passwords and traditional MFA. The remaining risk shifts to account recovery and enrollment - which is why this guide starts there.</p>

<h3>What happens if I lose my phone?</h3>
<p>If your passkeys sync through Apple, Google, or a password manager, sign in on any device and re-add the new phone. If your passkeys were device-bound (Windows Hello on one laptop only), you need your backup factor or recovery path. This is exactly why the synced-provider option is the right default for most people.</p>

<h3>Can I use passkeys on multiple devices?</h3>
<p>Yes - that is the point of synced passkeys. Apple (iCloud Keychain), Google (Password Manager), and password managers (1Password, Bitwarden, Dashlane) sync them securely across your devices. Device-bound passkeys exist too (FIDO2 security keys, Windows Hello on a single machine) and suit high-security work use.</p>

<h3>Do passkeys work everywhere yet?</h3>
<p>Not everywhere. The large consumer services - Google, Microsoft, Apple, Amazon, GitHub, and most major banks and social platforms - support them; smaller sites are still catching up. Where passkeys are unavailable, a password manager plus TOTP codes is the right fallback.</p>
