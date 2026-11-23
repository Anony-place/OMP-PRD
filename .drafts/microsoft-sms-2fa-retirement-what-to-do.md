# Draft backup — batch-38 (2026-11-23) — INSERTED via connector
# slug: microsoft-sms-2fa-retirement-what-to-do
# title: Microsoft SMS 2FA Retirement: What to Do Before February 2027
# category: News (b797c69d-b683-490b-b388-8f23506523fa)
# meta_title: Microsoft SMS 2FA Retirement: Deadlines & What to Do
# meta_description: Microsoft is retiring SMS and voice 2FA in Entra ID by February 2027. What the deadlines mean for your account, and exactly how to switch to passkeys.

<p>If you received an email from Microsoft about SMS and voice authentication, or your work IT team suddenly wants everyone to 'set up a passkey', this is what is happening: Microsoft is retiring its built-in SMS and voice two-factor authentication in Entra ID, and making passkeys the default. Here are the dates that matter, who is affected, and exactly what to do before the deadline.</p>

<h2>What Microsoft is actually retiring</h2>
<p>Microsoft Entra ID - the identity system behind Microsoft 365, Teams, and Azure work and school accounts - has long offered SMS codes and voice calls as a second factor. Microsoft has now <a href='https://learn.microsoft.com/en-us/entra/identity/authentication/concept-sms-voice-retirement' target='_blank' rel='noopener'>officially retired that built-in telephony option</a>, stating plainly that 'SMS and voice are no longer positioned as secure authentication methods' - which is accurate: both are defeated by SIM-swap and call-redirect attacks.</p>
<p>Two important scoping details:</p>
<ul>
<li><strong>This is about work and school (Entra ID) accounts</strong> - organisations with Microsoft 365, Teams, or Azure tenants. Your personal Outlook.com or Xbox account is a different system with its own roadmap (where passkeys are also being pushed, but not with this deadline).</li>
<li><strong>Microsoft is retiring the built-in SMS delivery, not the concept of SMS.</strong> Organisations that must keep SMS for regulatory or operational reasons can plug in their own telecom provider through the Microsoft Security Store (available from October 30, 2026).</li>
</ul>

<h2>The timeline: three dates that matter</h2>
<table>
<tr><th>Date</th><th>What happens</th><th>What you should do</th></tr>
<tr><td><strong>September 1, 2026</strong></td><td>Passkeys become the default sign-in experience. Users who had SMS or voice enabled are automatically enabled for passkeys and nudged to register one at MFA sign-in.</td><td>Register the passkey now, while it is still a gentle nudge.</td></tr>
<tr><td><strong>February 1, 2027</strong></td><td>Microsoft-provided SMS and voice authentication is retired for everyone except Global Administrators and external users. Anyone whose only MFA method is SMS or voice hits a <strong>blocking</strong> passkey-registration prompt at sign-in - no opt-out, no skipping.</td><td>Be on a phishing-resistant method (passkey, Windows Hello, or a FIDO2 security key) before this date - or pick a telephony provider.</td></tr>
<tr><td><strong>July 1, 2027</strong></td><td>The same retirement lands for Global Administrators and external users.</td><td>Admins: move yourselves first, not last.</td></tr>
</table>
<p>The blocking prompt is the headline: after February 1, a user whose only second factor is SMS will be forced to register a passkey during sign-in to continue. That is a helpdesk event at most organisations, which is why the prep work happens now.</p>

<h2>Who is affected - and who is not</h2>
<ul>
<li><strong>Affected:</strong> anyone using Microsoft-provided SMS codes or voice calls as their MFA for a work/school account. If you got Microsoft's notification email, your tenant has such users.</li>
<li><strong>Not affected:</strong> users on Microsoft Authenticator push, TOTP codes (including from the Authenticator app), Windows Hello, passkeys, or FIDO2 keys. TOTP verification codes remain supported - though note they are not phishing-resistant, so they will not satisfy policies that require phishing-resistant MFA.</li>
<li><strong>Confused by the email but never use SMS for work?</strong> If your organisation has no Entra tenant (no Microsoft 365 or Teams business licensing), you can usually ignore the notice - some recipients discovered the email referred to a forgotten free Azure signup.</li>
</ul>

<h2>What to do now - for individuals</h2>
<ol>
<li><strong>Register a passkey on your work account today</strong> - it takes minutes and removes the February pressure entirely. Our <a href='/articles/how-to-set-up-passkeys'>complete passkey setup guide</a> walks through every device.</li>
<li><strong>Set a TOTP code as your backup factor</strong> (Microsoft Authenticator or any authenticator app - see <a href='/articles/how-totp-works'>how TOTP works</a>). If you lose your passkey device, this is what saves you from a lockout.</li>
<li><strong>Check your recovery methods</strong> - a strong factor with weak recovery is exactly the gap attackers walk through, as our <a href='/articles/how-to-spot-fake-passkey-setup-scams-before-they-steal-your-account'>passkey scam guide</a> warns.</li>
<li><strong>Watch for phishing that uses this news.</strong> 'Microsoft requires you to set up a passkey - click here' is a perfect phishing pretext. The real prompt appears inside your normal sign-in flow, never in an email.</li>
</ol>

<h2>What to do now - for IT admins and small-business owners</h2>
<ol>
<li><strong>Find your SMS-only users</strong> (Authentication methods activity report in Entra) and run a registration campaign before the deadline.</li>
<li><strong>Mind the SSPR trap.</strong> The retirement applies to self-service password reset too - and passkeys are <em>not</em> an SSPR recovery method. Users moving from SMS to passkeys still need a separate reset path (Authenticator push, OATH/TOTP, or email OTP). Losing this detail locks people out of password resets.</li>
<li><strong>Decide on the telephony escape hatch</strong> - if a department genuinely needs SMS (operational or regulatory reasons), configure a customer-managed telecom provider from the Microsoft Security Store before February 1.</li>
<li><strong>There is a temporary opt-out</strong> of the automatic passkey enablement (a Graph API setting, <code>passkeyDynamicMigration</code>) for tenants still mid-transition - use it as a bridge, not a home.</li>
</ol>

<h2>Why Microsoft is doing this</h2>
<p>The stated reason is the AI era: as organisations adopt AI agents that sign in on users' behalf, phishable authentication becomes the weakest link at machine speed. Phishing-resistant factors - passkeys, Windows Hello, FIDO2 keys - remove the entire attack class. The FIDO Alliance's 2026 reporting puts roughly 7 billion passkeys in use worldwide, with sign-in success rates around 93% versus 78% for passwords and traditional MFA. Microsoft is not out ahead of the industry here; it is the largest domino falling. Apple, Google, and the password managers have all moved the same direction - <a href='/articles/fido2-vs-passkeys'>FIDO2 vs passkeys explained</a> covers how the standards fit together.</p>

<h2>FAQ</h2>

<h3>Is Microsoft removing SMS two-factor authentication completely?</h3>
<p>Microsoft is retiring its own SMS and voice delivery in Entra ID (work/school accounts) on February 1, 2027 for most users, and July 1, 2027 for Global Administrators and external users. Organisations can still use SMS through a third-party telecom provider from the Microsoft Security Store, and personal Microsoft accounts are a separate system.</p>

<h3>What happens if I do nothing before February 2027?</h3>
<p>If SMS or voice is your only MFA method, you will be forced to register a passkey at your next sign-in - a blocking prompt with no opt-out. Registering early, on your own schedule, is strictly less painful.</p>

<h3>Do I still need an authenticator app if I use passkeys?</h3>
<p>Keep one. TOTP codes remain supported and double as a backup factor and an SSPR path. Passkeys are the primary; the authenticator app is the seatbelt - see <a href='/articles/is-sms-2fa-safe-in-2026-what-it-protects-where-it-fails-and-what-to-use-instead'>what to use instead of SMS 2FA</a>.</p>

<h3>Does this affect my personal Microsoft account?</h3>
<p>The dated retirement applies to Entra ID work and school accounts. Personal Microsoft accounts are separately pushing passkeys, but this specific February 2027 deadline is about organisational tenants.</p>
