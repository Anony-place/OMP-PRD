# Impacket Guide: Scripts, Attacks and Detection (2026)

*Impacket is the Python network-protocol toolkit behind many modern Active Directory attacks — and the same scripts blue teams replay in the lab. Here is what it is, every major script, the attacks they power (mapped to MITRE ATT&CK), and how defenders catch them.*

**Quick answer:** Impacket is "a collection of Python classes for working with network protocols" — originally created by SecureAuth, now maintained by **Fortra's Core Security**. Its `examples/` scripts (psexec.py, secretsdump.py, GetUserSPNs.py, ntlmrelayx.py and dozens more) are the standard toolkit for Windows/AD security work. Latest stable: **v0.13.1** (May 2026); development is active (v0.14.0-dev, commits as recent as November 2026).

## What Impacket actually is

Impacket is not one tool — it is a **library** with example programs. The README describes its focus: low-level programmatic access to packets, with full protocol implementations for **SMB1-3 and MSRPC**, plus "plain, NTLM and Kerberos authentications, using password/hashes/tickets/keys." Partial implementations cover the MSRPC interfaces that Windows administration and abuse are built on (SAMR, LSAD, LSAT, SCMR, TSCH, DCOM, WMI, RRP and more), plus portions of TDS (MSSQL) and LDAP.

Concretely, the same `psexec.py` that red teams use to run a command on a host is used by admins and defenders to script the same protocol legitimately. The project's own disclaimer frames it as being "for research and educational purposes."

Facts at a glance (from the project repository, November 2026):

| | |
|---|---|
| Maintainer | Fortra's Core Security (originally SecureAuth) |
| Latest stable | Impacket v0.13.1 (May 19, 2026) |
| Development | v0.14.0-dev on master; active commits through Nov 2026 |
| Language / versions | Python 3.9 – 3.13 |
| License | Slightly modified Apache Software License |
| Community | 16.3k stars, 294 contributors (including well-known AD researchers) |
| Install | `python3 -m pipx install impacket` (the project recommends pipx over pip); Docker image supported |

Kali Linux ships Impacket out of the box; on other systems pipx keeps the scripts isolated and on your PATH.

## The scripts, grouped by job

Every name below exists in Impacket's `examples/` directory as of v0.13.x/0.14-dev. This is the mental map most testers carry.

### Remote command execution (the "exec" family)

| Script | Mechanism |
|---|---|
| `psexec.py` | Runs commands via a service it creates over SMB/DCERPC (PsExec-style) |
| `smbexec.py` | Command execution through SMB shares without dropping a service binary the same way |
| `wmiexec.py` | Executes via WMI (DCOM), quieter than a service install |
| `dcomexec.py` | Executes via DCOM objects (ShellWindows, ShellBrowserWindow, Excel) |
| `atexec.py` | Runs a command via the Task Scheduler service (AT/TSCH) |

### Credential access

| Script | Job |
|---|---|
| `secretsdump.py` | The flagship: extracts SAM, LSA secrets and NTDS.dit hashes locally or remotely (with `-history` for password history) |
| `regsecrets.py` | Registry-based secret extraction |
| `GetLAPSPassword.py` | Reads LAPS-managed local admin passwords |
| `Get-GPPPassword.py` | Recovers Group Policy Preferences passwords |
| `dpapi.py` / `dpapidump.py` | DPAPI credential work |
| `mimikatz.py` | Client wrapper for running Mimikatz-style commands over the wire |

### Kerberos and tickets

| Script | Job |
|---|---|
| `GetUserSPNs.py` | Finds SPNs and requests TGS tickets — the Kerberoasting workflow |
| `GetNPUsers.py` | AS-REP roasting: accounts with pre-auth disabled |
| `getTGT.py` | Requests a TGT (supports modern PKINIT certificate auth) |
| `getST.py` | Requests service tickets, including S4U delegation abuse |
| `ticketer.py` | Forges golden/silver-style tickets from a known key |
| `ticketConverter.py` | Converts tickets between ccache and KRB-CRED formats |
| `describeTicket.py` | Parses ticket/PAC contents for analysis |
| `findDelegation.py` | Maps unconstrained/constrained/RBCD delegation |
| `keylistattack.py` | RODC key-list attack (updated for PAC-hardened DCs in 2026) |
| `badsuccessor.py` | Works the dMSA "Bad Successor" delegation path |

### Enumeration and reconnaissance

`GetADUsers.py`, `GetADComputers.py`, `lookupsid.py`, `samrdump.py`, `netview.py`, `rpcdump.py`, `rpcmap.py`, `wmiquery.py`, `mssqlclient.py`, `mssqlinstance.py`, `checkMSSQLStatus.py`, `CheckLDAPStatus.py` (LDAP signing/channel-binding status — useful for defenders too).

### Relay and object abuse

| Script | Job |
|---|---|
| `ntlmrelayx.py` | The NTLM relay workhorse — relays captured authentications to SMB, LDAP, HTTP, AD CS and more. 2026 additions: SMB/LDAP signing bypass via cross-user re-authentication, AD CS CES relay |
| `rbcd.py` / `owneredit.py` / `dacledit.py` | Resource-based constrained delegation and ACL/owner manipulation |
| `addcomputer.py` / `changepasswd.py` | Machine-account creation and password changes |

### Files and host interaction

`smbclient.py` (interactive SMB browsing), `smbserver.py` (standalone SMB server with NTLM/Kerberos signing support — handy for captures and payload staging in labs), `services.py`, `reg.py`, `smbexec.py`'s share-based approach, plus packet-level examples (`ping.py`, `sniffer.py`, `getArch.py`).

## The attacks these scripts power, mapped to MITRE ATT&CK

Defenders should read Impacket output through the same lens as the ATT&CK technique it serves:

**Kerberoasting — T1558.003.** `GetUserSPNs.py -request` pulls TGS tickets for SPN accounts and the offline crack targets RC4 (etype 23) tickets. Detection centers on Windows **4769** events with unusual encryption types and volume. Full mechanics in our [Active Directory Lateral Movement](/articles/active-directory-lateral-movement) guide.

**DCSync — T1003.006.** MITRE defines it as abusing "a Windows Domain Controller's API to simulate the replication process from a remote domain controller" to "pull password data … current and historical hashes of potentially useful accounts such as KRBTGT." `secretsdump.py` performs this style of directory-dump against domain controllers (its `-history` mode also surfaces password-history hashes, and the SAM/NTDS extraction itself maps to T1003.003 "NTDS"). Groups from LAPSUS$ to Scattered Spider are documented using this technique.

**Pass the Hash — T1550.002.** Authenticating "as a user without having access to the user's cleartext password" using captured hashes. Every exec-family script accepts `-hashes LM:NT` style authentication instead of a password.

**Pass the Ticket — T1550.003.** Using forged or stolen Kerberos tickets (`ticketer.py`, `getST.py`, `ticketConverter.py`) to move without credentials at all.

## Usage patterns

Everything follows one identity format, which is why the toolkit feels uniform:

```
# password auth
psexec.py CORP/admin:Password123@10.10.10.25

# pass-the-hash (LM:NT — leave LM empty if you only have the NT hash)
wmiexec.py CORP/admin@10.10.10.25 -hashes :32ed87bdb5fdc5e9cba88547376818d4

# Kerberoasting
GetUserSPNs.py CORP/admin:Password123 -dc-ip 10.10.10.5 -request

# install
python3 -m pipx install impacket
```

Common flags shared across scripts: `-hashes` for pass-the-hash, `-dc-ip` for the domain controller, `-k` for Kerberos/ccache auth, `-no-pass` for certificate-based flows. The `-hashes` and `-dc-ip` flags are the ones you will type most.

## How defenders detect Impacket activity

Impacket is powerful because it speaks **native protocols** — which means its activity lands in the same logs as legitimate administration:

- **Service creation and execution** (`psexec.py`, `smbexec.py`): Service Control Manager service-installation events plus new, oddly named services connecting to admin shares.
- **NTLM authentication anomalies** (`wmiexec.py`, `dcomexec.py`, `secretsdump.py` remote): type-3 NTLM logons (4624) from workstations or accounts that do not normally touch the target, especially to ADMIN$/C$.
- **Kerberoasting noise** (`GetUserSPNs.py`): spikes of 4769 requests, particularly RC4 (etype 23) TGS requests across many SPNs in a short window.
- **Directory replication abuse** (`secretsdump.py` DCSync mode): directory-service access/replication requests from non-DC accounts — the tell for T1003.006.
- **Relay attempts** (`ntlmrelayx.py`): the reason to **enforce SMB and LDAP signing** — unsigned sessions are what relays feed on. Impacket's own 2026 work on signing bypasses shows how much pressure this control is under.
- **Application control and EDR**: execution-via-service and script-host behavior is exactly what application-control rules and EDR behavioral detections are for — see [Application Control vs EDR](/articles/application-control-vs-edr).

If you run Impacket in a SOC lab, tune detections against these five shapes — they cover the majority of real incidents where the toolkit appears.

## FAQ

**Is Impacket legal?**
Yes, for what it is licensed and documented for: research, education, and authorized testing. The project's disclaimer states the repository is "for research and educational purposes and not meant to be used in production environments and/or as part of commercial products." Running its scripts against systems you do not own or are not authorized to test is not legal — the same rule as every pentest tool.

**Is Impacket a virus / why does my antivirus flag the scripts?**
The toolkit is dual-use: the same `psexec.py` that helps admins is used in intrusions. AV and EDR products flag the scripts or their behavior because real attackers ship them. In a lab, expect detections — that is the product working.

**What is the difference between Impacket and CrackMapExec/NetExec?**
Impacket is a protocol library plus focused single-purpose scripts. Wrapper frameworks automate larger sweeps across many hosts using similar underlying protocols. Most professionals keep Impacket installed for precise work and pair it with a wrapper for scale.

**Do I need Visual Studio or Windows to install it?**
No. It is pure Python: `pipx install impacket` works on Linux, macOS and Windows with Python 3.9+.

**What replaced the older script names I see in old write-ups?**
Impacket evolved (Python 2 era scripts, renamed flags like `-dcip` → `-dc-ip`). If an old tutorial fails, check the current `-help` of the script — the v0.13.x/0.14-dev names in this guide are the current ones as of November 2026.

## Related guides

- [Active Directory Lateral Movement: Techniques and Detection](/articles/active-directory-lateral-movement) — where these scripts fit in the attack chain.
- [Impacket tool page](/pentest/impacket) — the quick-reference catalog entry.
- [Active Directory category](/pentest/category/active-directory-internal-network) — more AD tooling.
- [Active Directory Enumeration Cheat Sheet](/cheatsheets/active-directory-enumeration-cheatsheet) — the command-level companion.
