-- Four common questions on every tool page instead of one.
--
-- The Pentest Hub answered a single question per tool; 15 of those answers
-- shipped as a bare paragraph with the question buried inside the same line.
-- Each row now carries four Q&A pairs in <h3>/<p> form: the original answer
-- (kept verbatim) plus three a reader actually asks - cost, platform, limits,
-- or the mistake people make with that tool.
--
-- The static publisher renders faqs into the page body, so updating the rows
-- republishes the pages. Idempotent: it overwrites faqs only.


update public.pentest_tools set faqs = $omp$<h3>Is Aircrack-ng free?</h3>
<p>Yes. The whole suite is free and open source.</p>
<h3>Do I need a special Wi-Fi adapter?</h3>
<p>Yes. Monitor mode and packet injection need a chipset that supports it (Atheros AR9271 and Alfa adapters are the usual picks). A stock laptop card usually cannot capture handshakes.</p>
<h3>Is aircrack-ng still maintained?</h3>
<p>The suite gets occasional maintenance releases rather than active feature work. It remains the reference toolkit for WPA handshake capture and cracking.</p>
<h3>Can it crack WPA3?</h3>
<p>Not really. WPA3-SAE removes the offline handshake attack aircrack-ng relies on; only downgrade and transition-mode weaknesses are in reach, and those need different tooling.</p>$omp$ where slug = 'aircrack-ng';

update public.pentest_tools set faqs = $omp$<h3>Is Autopsy only for cybercrime investigations?</h3>
<p>No. It is also used for incident response, internal investigations and forensic training.</p>
<h3>Does Autopsy modify the evidence?</h3>
<p>No. It reads the image and writes findings to its own case database, so the original file is untouched. Work from a verified copy and record its hash.</p>
<h3>Which image formats can it open?</h3>
<p>Raw dd, E01/Ex01 (via libewf), VHD/VHDX and AFF, plus live local disks if you point it at one. Attached images open read-only.</p>
<h3>Is there a free version?</h3>
<p>Autopsy is free and open source (Apache 2.0). The paid Autopsy edition is a separate commercial product for large lab deployments.</p>$omp$ where slug = 'autopsy';

update public.pentest_tools set faqs = $omp$<h3>Does a displayed path guarantee compromise?</h3>
<p>No. It indicates a relationship to validate against actual permissions and environmental controls.</p>
<h3>Which collectors work with CE?</h3>
<p>SharpHound (the bundled Windows collector) and BloodHound.py for Linux. Match the collector version to the server version or the upload is rejected.</p>
<h3>Is CE different from BloodHound Legacy?</h3>
<p>CE is the supported product: it bundles Neo4j and PostgreSQL behind a web UI. Legacy (the old desktop app with a separate Neo4j install) is end-of-life.</p>
<h3>Why is my upload rejected?</h3>
<p>Almost always a version mismatch between SharpHound and the server. Download SharpHound from the CE instance itself rather than an old copy.</p>$omp$ where slug = 'bloodhound-community-edition';

update public.pentest_tools set faqs = $omp$<h3>Is Burp Suite free?</h3>
<p>Burp Suite Community is free. Burp Suite Professional is paid and adds the active scanner, full-speed Intruder and collaboration features.</p>
<h3>Community vs Professional - what is missing?</h3>
<p>Community has no active scanner, throttles Intruder and lacks the BApp API extensions. For learning, the proxy, Repeater and Decoder are all there.</p>
<h3>Does it need Java?</h3>
<p>Modern releases bundle their own runtime. If you use the standalone JAR instead, install a current JDK first.</p>
<h3>Can I use it without a browser proxy setup?</h3>
<p>Yes - the built-in browser is preconfigured. For your own browser, install the PortSwigger CA certificate, otherwise HTTPS sites fail to load.</p>$omp$ where slug = 'burp-suite';

update public.pentest_tools set faqs = $omp$<h3>Does DNS resolution prove a service is vulnerable?</h3>
<p>No. It only provides DNS evidence; assess services separately.</p>
<h3>How is it different from dig?</h3>
<p>dnsx takes a list on stdin and returns one line per host, which makes it pipeline-friendly. dig answers one query at a time for humans.</p>
<h3>Why do some hosts return nothing?</h3>
<p>No A/AAAA record, or the resolver timed out. Raise -retry and -t, and use -wd to drop wildcard answers that would otherwise look like hits.</p>
<h3>Does it resolve through my own resolver?</h3>
<p>Yes - pass -r resolvers.txt to use a specific list, which is how you spot resolver-based split-horizon differences.</p>$omp$ where slug = 'dnsx';

update public.osint_tools set faqs = $omp$<h3>Is Epieos free?</h3>
<p>Basic lookups are free. Deeper modules covering networks like LinkedIn and Facebook need a paid plan — check the Pricing page on their site for current rates.</p>
<h3>What can it look up?</h3>
<p>Email to Google account, to LinkedIn and other linked services; phone numbers; and public breach references. Each module returns whatever that service exposes.</p>
<h3>Do lookups notify the target?</h3>
<p>The free modules query public endpoints, not the person. Even so, investigate only people you have a legitimate reason to look into.</p>
<h3>Does it store my queries?</h3>
<p>Epieos requires an account for most modules and keeps a query history, so treat your searches as logged. Use a work account for client work.</p>$omp$ where slug = 'epieos';

update public.osint_tools set faqs = $omp$<h3>Is ExifTool free?</h3>
<p>Yes. ExifTool is free and open source.</p>
<h3>What metadata actually survives today?</h3>
<p>Cameras and scanners still embed rich EXIF; most social networks strip it on upload. GPS coordinates, device model and timestamps are the usual finds.</p>
<h3>How do I strip metadata before publishing?</h3>
<p>exiftool -all= file.jpg removes everything; -overwrite_original writes in place. Keep a copy of the original if it is evidence.</p>
<h3>Can it read more than photos?</h3>
<p>Yes: PDF documents, Office properties, video containers, and even file-system timestamps with care. It is the general metadata reader.</p>$omp$ where slug = 'exiftool';

update public.pentest_tools set faqs = $omp$<h3>Is ffuf a vulnerability scanner by itself?</h3>
<p>It finds responses worth investigating; response differences still need interpretation and verification.</p>
<h3>Why am I getting thousands of 200s?</h3>
<p>The target returns a catch-all page. Filter by size (-fs), word count (-fw) or line count (-fl) using the size of a known random path.</p>
<h3>Can it fuzz more than paths?</h3>
<p>Yes: FUZZ works in headers, POST bodies, host names and query values. Multiple wordlists in one run are supported with -w name:file and FUZZNAME placeholders.</p>
<h3>How do I slow it down?</h3>
<p>Lower -t (threads) and add -p 0.1-1.0 to delay between requests. Rate-limit yourself before someone else does.</p>$omp$ where slug = 'ffuf';

update public.pentest_tools set faqs = $omp$<h3>Is Frida an automated vulnerability scanner?</h3>
<p>No. It is an instrumentation framework that supports manual analysis and custom tooling.</p>
<h3>Do I need a rooted device?</h3>
<p>On Android, frida-server needs root unless you repackage the APK with the gadget. On iOS you need a jailbroken or otherwise instrumentable device.</p>
<h3>What is the gadget?</h3>
<p>A shared library you embed in an app so Frida can attach without a rooted device. Standard route for instrumenting your own production builds.</p>
<h3>Python client or CLI?</h3>
<p>Same engine. frida-trace and frida-ps are the quick CLI entry points; the Python API is what you use to automate a workflow.</p>$omp$ where slug = 'frida';

update public.pentest_tools set faqs = $omp$<h3>Does deleting a leaked token fix the incident?</h3>
<p>Not by itself. Revoke or rotate the credential, investigate use and then clean repository history if appropriate.</p>
<h3>Does it need the full git history?</h3>
<p>No - gitleaks dir scans a plain directory. Full history catches secrets that were committed and later removed, which is exactly what leaks usually are.</p>
<h3>How do I stop false positives?</h3>
<p>Add an allowlist to .gitleaks.toml (path, regex or commit) or an inline 'gitleaks:allow' comment. Keep the baseline file for known, accepted findings.</p>
<h3>Can it run before the commit?</h3>
<p>Yes: gitleaks git --pre-commit --staged, wired through pre-commit or a git hook, blocks a secret before it ever reaches history.</p>$omp$ where slug = 'gitleaks';

update public.pentest_tools set faqs = $omp$<h3>Is Hashcat free?</h3>
<p>Yes. It is free and open source.</p>
<h3>Which hash modes do I need?</h3>
<p>Mode IDs select the algorithm: 0 MD5, 1000 NTLM, 1400 SHA-256, 22000 WPA. Run hashcat -h once and keep the mode list handy.</p>
<h3>Why does it say 'no hashes loaded'?</h3>
<p>The hash file format is wrong for the chosen -m, or the file has extra whitespace. Check with --identify first.</p>
<h3>GPU or CPU?</h3>
<p>GPU is the point - hashcat drops to a fraction of its speed on CPU. If OpenCL cannot see your GPU, fix the driver before blaming the tool.</p>$omp$ where slug = 'hashcat';

update public.osint_tools set faqs = $omp$<h3>Is Holehe free?</h3>
<p>Yes. Holehe is free and open source under the MIT license.</p>
<h3>What does 'registered' mean?</h3>
<p>The service's password-reset or signup endpoint responded in a way that implies the account exists. It is an inference, not a confirmation.</p>
<h3>Why are some sites always wrong?</h3>
<p>Endpoints that answer identically for known and unknown emails produce false positives. Cross-check any hit on the site itself.</p>
<h3>Is it rate limited?</h3>
<p>Different sites throttle differently. Use --only-used to cut noise and expect some sites to block you after repeated runs.</p>$omp$ where slug = 'holehe';

update public.pentest_tools set faqs = $omp$<h3>Is this the Python httpx library?</h3>
<p>No. This entry is ProjectDiscovery’s security reconnaissance CLI.</p>
<h3>What does it actually check?</h3>
<p>Whether a host speaks HTTP(S), then status code, title, TLS details, response headers, detected technologies and CDN/WAF fingerprints.</p>
<h3>Why do some hosts time out?</h3>
<p>Port 443/80 may be filtered, or the service is not HTTP. Add -ports and -timeout, and remember no response is itself a finding.</p>
<h3>Can it screenshot pages?</h3>
<p>Not by itself. Chain katana or gau for URLs and use a headless browser for screenshots - httpx stays a fast metadata prober.</p>$omp$ where slug = 'httpx-probe';

update public.pentest_tools set faqs = $omp$<h3>Is Hydra free?</h3>
<p>Yes. It is free and open source.</p>
<h3>Why do I keep getting 'target refused'?</h3>
<p>Wrong service module or port. Point -s at the real port and confirm the protocol with nmap first; hydra guesses the module, it does not detect it.</p>
<h3>Is account lockout a risk?</h3>
<p>Always. Hydra will happily lock every account on a real system. On authorized tests set -t low, -W between attempts, and agree a lockout threshold with the owner.</p>
<h3>SSH keeps failing - why?</h3>
<p>Modern OpenSSH limits auth attempts per connection (MaxAuthTries). Use -t 4 and expect slow progress; brute forcing SSH is usually the wrong approach.</p>$omp$ where slug = 'hydra';

update public.pentest_tools set faqs = $omp$<h3>Is Impacket a single scanner?</h3>
<p>No. It is a library and a collection of protocol-oriented tools.</p>
<h3>Which scripts do I start with?</h3>
<p>secretsdump.py for credential extraction, psexec.py, wmiexec.py and smbexec.py for execution, GetUserSPNs.py for Kerberoasting. Everything else builds on those.</p>
<h3>Does it work from Linux against Windows?</h3>
<p>Yes - that is its main use. It speaks the protocols natively over Python, so no Windows tooling is needed on the attacking side.</p>
<h3>Is it maintained?</h3>
<p>Actively, by Fortra (formerly SecureAuth). Install from PyPI rather than a stale distro package.</p>$omp$ where slug = 'impacket';

update public.pentest_tools set faqs = $omp$<h3>Is decompiled code identical to the original source?</h3>
<p>No. Names and structure may be lost through compilation, optimization or obfuscation.</p>
<h3>What if the app is obfuscated?</h3>
<p>Run with --deobf to rename classes to readable placeholders, then follow the manifest and string constants. Obfuscation slows reading, it does not hide behaviour.</p>
<h3>APK or DEX?</h3>
<p>Both. An APK unpacks automatically; a bare classes.dex works too. Split APKs can be merged first with apkeep or a similar tool.</p>
<h3>Why do some decompiled files fail?</h3>
<p>Some methods defeat the decompiler and stay as smali. Read the smali, or try --show-bad-code to see what jadx produced.</p>$omp$ where slug = 'jadx';

update public.pentest_tools set faqs = $omp$<h3>John or Hashcat?</h3>
<p>John for encrypted files and slow hashes on CPU; Hashcat for fast hashes on GPU. Auditors keep both.</p>
<h3>Jumbo or core?</h3>
<p>Take jumbo: it is the community build with GPU support, more formats and all the rules. Core is the minimal official tarball.</p>
<h3>Where do I get wordlists?</h3>
<p>rockyou.txt ships with Kali; SecLists is the larger general collection. Rules (best64, OneRuleToRuleThemAll) get more out of the same list than a bigger one.</p>
<h3>How do I see cracked passwords?</h3>
<p>john --show hashes.txt prints recovered ones, and --pot=name.pot keeps several engagements separate.</p>$omp$ where slug = 'john-the-ripper';

update public.pentest_tools set faqs = $omp$<h3>Should every discovered URL be tested automatically?</h3>
<p>No. Review scope and avoid state-changing or destructive requests without approval.</p>
<h3>Crawling or parsing?</h3>
<p>Both in one pass: standard mode follows links found in HTML, -jc also extracts endpoints from inline and external JavaScript.</p>
<h3>Why so few results?</h3>
<p>The site may be JS-rendered. Add -headless to run a real browser, which is slower but sees what a user sees.</p>
<h3>Does it respect scope?</h3>
<p>Only what you give it. Use -fs to filter out off-domain URLs so you do not wander outside the engagement scope.</p>$omp$ where slug = 'katana';

update public.pentest_tools set faqs = $omp$<h3>Does discovering a route confirm an API vulnerability?</h3>
<p>No. It identifies endpoints to inspect for authentication, authorization and input-validation issues.</p>
<h3>Why not just ffuf?</h3>
<p>Kiterunner matches full REST route shapes (path plus method plus expected response size), so it finds API endpoints that word-for-word directory brute force misses.</p>
<h3>Do I need Assetnote wordlists?</h3>
<p>The release bundles routes.kite, which is enough to start. The Assetnote API wordlists add coverage if you register for them.</p>
<h3>What do the flags mean?</h3>
<p>-x is concurrency, -j is the number of requests per second to hold back, and --ignore-length drops the wildcard response size.</p>$omp$ where slug = 'kiterunner';

update public.osint_tools set faqs = $omp$<h3>Maigret or Sherlock — which should I use?</h3>
<p>Use Sherlock for a fast existence check across 400+ sites. Use Maigret when you need depth: 3000+ sites, leaked-data checks and a written HTML or PDF report.</p>
<h3>How many sites does it check?</h3>
<p>Around 3,000, ordered by popularity, so -top-sites 500 gives a fast first pass and the full run is the exhaustive one.</p>
<h3>What reports can it make?</h3>
<p>HTML, PDF and JSON dossiers (--html, -P, --json). The HTML report keeps the found-profile links, which is what you actually cite.</p>
<h3>Do I need API keys?</h3>
<p>No. The default checks are free; a few optional modules that read leaked-data sources need their own keys.</p>$omp$ where slug = 'maigret';

update public.pentest_tools set faqs = $omp$<h3>Masscan or Nmap?</h3>
<p>Masscan finds what answers across huge ranges fast; Nmap examines each host deeply. Use Masscan for discovery, Nmap for detail.</p>
<h3>Why does 65536 packets per second matter?</h3>
<p>Masscan is asynchronous and stateless: it sends and forgets, which is why it can scan the whole IPv4 space quickly and why it needs raw socket privileges.</p>
<h3>Is it legal to scan the internet?</h3>
<p>Scanning hosts you do not own is not authorized testing. Restrict --exclude / -iL lists to your own ranges, and never point it at a third party.</p>
<h3>How do I get one line per open port?</h3>
<p>-oL out.txt gives a grep-friendly list, --rate controls speed, and --source-ip sets the interface address when you have several.</p>$omp$ where slug = 'masscan';

update public.pentest_tools set faqs = $omp$<h3>Is Metasploit free?</h3>
<p>The Framework is free and open source. Metasploit Pro (automation, reporting, team features) is paid.</p>
<h3>Framework or msfconsole?</h3>
<p>The package is Metasploit Framework; the console you actually use is msfconsole. Start there, run 'search <cve>' and read the module options.</p>
<h3>Community or Pro?</h3>
<p>Framework (Community) is free and includes the exploit modules. Pro adds automation and reporting for professional engagements.</p>
<h3>Why does an exploit just fail?</h3>
<p>Target mismatch, wrong payload or a patched service. Check the module's targets and set RHOSTS/LHOST/LPORT correctly before assuming the exploit is wrong.</p>$omp$ where slug = 'metasploit';

update public.pentest_tools set faqs = $omp$<h3>Can MobSF guarantee an app is secure?</h3>
<p>No. Automated results need manual review and platform-specific testing.</p>
<h3>Does my APK leave my machine?</h3>
<p>No. MobSF runs locally in Docker and stores reports in a local volume; nothing is uploaded to a third party by default.</p>
<h3>What can it analyse?</h3>
<p>Android APK/AAB, iOS IPA and source archives. Static analysis is immediate; dynamic analysis needs a rooted Android emulator connected to the container.</p>
<h3>Is the API usable in CI?</h3>
<p>Yes - upload via /api/v1/upload, scan via /api/v1/scan and pull the JSON report. That is the usual way to gate a mobile build.</p>$omp$ where slug = 'mobsf';

update public.pentest_tools set faqs = $omp$<h3>Is Nikto free?</h3>
<p>Yes. It is free and open source.</p>
<h3>Is a Nikto result a vulnerability?</h3>
<p>No. It is an indicator: a header version or a file that looks interesting. Confirm manually before it goes in a report.</p>
<h3>Why is it so slow?</h3>
<p>Nikto runs over 6,000 checks with evasion and timing tunables. Use -Tuning to cut the check set and -maxtime to bound the run.</p>
<h3>Does it handle HTTPS and auth?</h3>
<p>Yes: -ssl, and -id user:pass for HTTP basic auth. For modern apps it is a supplement to a proxy-based scanner, not a replacement.</p>$omp$ where slug = 'nikto';

update public.pentest_tools set faqs = $omp$<h3>Is Nmap free?</h3>
<p>Yes. Nmap is free and open source.</p>
<h3>Which script category should I start with?</h3>
<p>default (-sC) for safe discovery, then vuln or discovery scoped to the ports you found. Never run vuln against hosts you do not own.</p>
<h3>Why does the scan say 'filtered'?</h3>
<p>A firewall is dropping the probes. Try -Pn to skip host discovery and a slower -T2 timing profile before concluding the host is down.</p>
<h3>Is -A too noisy?</h3>
<p>-A turns on OS detection, version detection, scripts and traceroute at once. On a real engagement use the individual flags so you know what caused each alert.</p>$omp$ where slug = 'nmap';

update public.pentest_tools set faqs = $omp$<h3>Does a Nuclei alert always mean a confirmed vulnerability?</h3>
<p>No. Verify the response and affected version or behavior before reporting.</p>
<h3>Where do templates come from?</h3>
<p>The nuclei-templates repository, pulled with -update-templates. Pin a version in CI so a template change does not silently alter results.</p>
<h3>Can I write my own?</h3>
<p>Yes - a YAML file with a request and matchers. Custom templates are how teams cover business logic that the public set does not know about.</p>
<h3>Why do I get so many results?</h3>
<p>Rate and scope. Use -severity, -tags and -rl to keep the run focused, and treat every hit as a lead to verify.</p>$omp$ where slug = 'nuclei';

update public.pentest_tools set faqs = $omp$<h3>Is Amass free?</h3>
<p>The project is open source. Use it only for domains and assets you are authorized to assess.</p>
<h3>Why is it so slow?</h3>
<p>Amass correlates dozens of passive sources and builds a graph. First runs are minutes; the -timeout and -max-dns-queries flags bound it.</p>
<h3>What is the database for?</h3>
<p>Enumeration results land in a local graph database so later queries and the visualisation can reuse them. -df points it at another store.</p>
<h3>Active or passive?</h3>
<p>Passive sources only query third parties. -active and -brute send traffic to the target, so they need explicit authorization.</p>$omp$ where slug = 'owasp-amass';

update public.pentest_tools set faqs = $omp$<h3>Is ZAP really free?</h3>
<p>Yes — every feature, including the active scanner and API, is free and open source.</p>
<h3>Is ZAP a replacement for Burp?</h3>
<p>It is a credible free alternative: proxy, spider, passive and active scanning, plus automation via the packaged scans in the API. Burp wins on extensions and manual workflow.</p>
<h3>How do I scan an authenticated app?</h3>
<p>Record a login in the AJAX spider with a context, then reuse that context for the active scan. Unauthenticated scans miss most of the app.</p>
<h3>Can it run in CI?</h3>
<p>Yes - zap-baseline.py and zap-full-scan.py in Docker are the standard approach, and the Automation Framework is the current recommended route.</p>$omp$ where slug = 'owasp-zap';

update public.osint_tools set faqs = $omp$<h3>What format does the number need?</h3>
<p>International format with the country code, for example +33612345678.</p>
<h3>Can I find the owner of a number?</h3>
<p>No tool can. PhoneInfoga aggregates public signals: carrier, line type, country and any footprint the number left in search results.</p>
<h3>Why does the carrier look wrong?</h3>
<p>Number portability. A prefix shows the original allocation; the current carrier needs a live HLR lookup, which most free tiers do not provide.</p>
<h3>Do I need API keys?</h3>
<p>Not for the built-in scanners. numverify and similar improve coverage but are optional, and the CLI runs without them.</p>$omp$ where slug = 'phoneinfoga';

update public.pentest_tools set faqs = $omp$<h3>Does Prowler need cloud credentials?</h3>
<p>Many assessments require permissions to read configuration. Use least-privilege, review the official guide and protect generated reports.</p>
<h3>What permissions does it need?</h3>
<p>Read-only: SecurityAudit plus ViewOnlyAccess covers most checks. Prowler never changes your account, but it does call many read APIs.</p>
<h3>Who pays for the API calls?</h3>
<p>You do - checks are metadata calls, which are free in AWS, but a cross-account run still needs credentials for every account.</p>
<h3>How do I track a fix?</h3>
<p>Export to CSV/JSON/OCSF and diff two runs. The delta is your progress; a single report is only a snapshot.</p>$omp$ where slug = 'prowler';

update public.pentest_tools set faqs = $omp$<h3>Does Schemathesis replace manual API security testing?</h3>
<p>No. It complements authorization, business-logic and abuse-case testing.</p>
<h3>What does it find that unit tests miss?</h3>
<p>Inputs nobody thought of: negative numbers in IDs, huge strings, wrong content types, and 500s raised where the spec promised 400.</p>
<h3>Does it need a running server?</h3>
<p>Yes - it talks to the live API, or to a WSGI/ASGI app through the Python integration for in-process testing.</p>
<h3>Can I use it with any framework?</h3>
<p>Anything that publishes OpenAPI, Swagger 2.0 or GraphQL. The spec is the contract; Schemathesis attacks that contract.</p>$omp$ where slug = 'schemathesis';

update public.pentest_tools set faqs = $omp$<h3>Can static analysis prove exploitability?</h3>
<p>No. Use the finding as a lead and validate data flow, reachability and impact.</p>
<h3>Is it just regex?</h3>
<p>No - it parses the code into an AST, so a rule matches structure and data flow, not text. That is why it survives reformatting and catches tainted input.</p>
<h3>How fast is it?</h3>
<p>Seconds on a mid-sized repo for a small rule set, which is why it works as a pre-commit or PR gate rather than a nightly job.</p>
<h3>Which rules do I start with?</h3>
<p>--config auto picks community rules from the detected languages. Pin a ruleset (p/owasp-top-ten, p/secrets) for reproducible CI results.</p>$omp$ where slug = 'semgrep';

update public.osint_tools set faqs = $omp$<h3>Is Sherlock free?</h3>
<p>Yes. Sherlock is free and open source under the MIT license. It runs entirely on your own machine, needs no account and no API key.</p>
<h3>How many sites does it cover?</h3>
<p>400+ popular platforms, ordered by traffic. --site lets you check a single site, and the data file is easy to extend.</p>
<h3>Are the results reliable?</h3>
<p>A hit means the username resolved on that site, not that it is the same person. Two matching identifiers are still the minimum to link accounts.</p>
<h3>Why so many false positives?</h3>
<p>Sites with soft-404 responses return 200 for any username. Use --print-found with --timeout, and verify unusual hits by hand.</p>$omp$ where slug = 'sherlock';

update public.osint_tools set faqs = $omp$<h3>Is Shodan free?</h3>
<p>A free account covers basic lookups. Membership and API credits for automation, history and monitoring are paid.</p>
<h3>Where does the data come from?</h3>
<p>Shodan scans the internet continuously and indexes service banners. It shows you what was visible at scan time, not necessarily now.</p>
<h3>Is using Shodan active scanning?</h3>
<p>No - you are reading someone else's scan results, which keeps you passive. Verifying a hit against the host is what turns it active.</p>
<h3>How do filters help?</h3>
<p>org:, country:, product: and port: narrow the index to what matters. The free tier has limited filters and no historical data.</p>$omp$ where slug = 'shodan';

update public.pentest_tools set faqs = $omp$<h3>Is SpiderFoot fully passive?</h3>
<p>Behavior depends on enabled modules and data sources; review module behavior before a run.</p>
<h3>How many modules does it have?</h3>
<p>Over 200, split into passive (third-party data) and active (direct to target) sets. Passive modules need no API key; the key-based ones add depth.</p>
<h3>What is the correlator for?</h3>
<p>It cross-links findings from different modules, which is how a domain turns into an organisation, then into contacts. Without it, you just get rows.</p>
<h3>Can I run a scan from the CLI?</h3>
<p>Yes: sf.py -s example.com -t DOMAIN_NAME -m all -o tab. Useful for scheduled recon; the UI is for exploring results.</p>$omp$ where slug = 'spiderfoot';
update public.osint_tools set faqs = $omp$<h3>Is SpiderFoot fully passive?</h3>
<p>Behavior depends on enabled modules and data sources; review module behavior before a run.</p>
<h3>How many modules does it have?</h3>
<p>Over 200, split into passive (third-party data) and active (direct to target) sets. Passive modules need no API key; the key-based ones add depth.</p>
<h3>What is the correlator for?</h3>
<p>It cross-links findings from different modules, which is how a domain turns into an organisation, then into contacts. Without it, you just get rows.</p>
<h3>Can I run a scan from the CLI?</h3>
<p>Yes: sf.py -s example.com -t DOMAIN_NAME -m all -o tab. Useful for scheduled recon; the UI is for exploring results.</p>$omp$ where slug = 'spiderfoot';

update public.pentest_tools set faqs = $omp$<h3>Is SQLMap free?</h3>
<p>Yes. It is free and open source.</p>
<h3>Which level and risk should I use?</h3>
<p>Start at --level=1 --risk=1. Raising them multiplies requests and, at risk 3, adds payloads that can damage data - only on labs.</p>
<h3>How do I avoid breaking the app?</h3>
<p>--batch for unattended runs, --threads 1-2, and a scope you own. Test only parameters you are authorized to test.</p>
<h3>It says 'not injectable' - am I done?</h3>
<p>No. Try --level=5 --risk=2 with the right technique (--technique=BEUSTQ), or the parameter may need a cookie or header injection point.</p>$omp$ where slug = 'sqlmap';

update public.pentest_tools set faqs = $omp$<h3>Does Subfinder need API keys?</h3>
<p>Some data sources require provider keys. Check the official installation guide for current requirements.</p>
<h3>Passive only - is that enough?</h3>
<p>It finds names that already appear somewhere public: certificates, DNS datasets, search indexes. Names that were never published need brute forcing, which is a different tool.</p>
<h3>How do I add API keys?</h3>
<p>Put them in ~/.config/subfinder/provider-config.yaml. Sources without keys still work; keys mostly unlock more coverage and speed.</p>
<h3>Why is a subdomain missing?</h3>
<p>No single source sees everything. Add -all, add keys, and accept that passive enumeration is a starting list, not an inventory.</p>$omp$ where slug = 'subfinder';

update public.pentest_tools set faqs = $omp$<h3>Does tcpdump decrypt TLS traffic automatically?</h3>
<p>No. It can capture encrypted traffic, but decryption requires appropriate keys and supported conditions.</p>
<h3>How do I capture on a busy link without dropping packets?</h3>
<p>Write straight to disk with -w and increase the buffer with -B; analysis happens later in Wireshark. Printing decoded packets is what drops frames.</p>
<h3>Why are my packets truncated?</h3>
<p>Default snaplen cuts at 262144 bytes only if you set -s 0; otherwise set -s 0 explicitly to capture full frames.</p>
<h3>Can I capture without root?</h3>
<p>Yes if the binary has file capabilities (CAP_NET_RAW) or you belong to a group granted them. Distributions often ship both options.</p>$omp$ where slug = 'tcpdump';

update public.pentest_tools set faqs = $omp$<h3>Can it test non-HTTPS services?</h3>
<p>It supports TLS/STARTTLS services on various ports; check the official documentation for protocol-specific options.</p>
<h3>What is the difference from an online SSL test?</h3>
<p>Nothing is uploaded and nothing is stored: the script opens the same TLS connections from your machine, which is what you want for internal or pre-release hosts.</p>
<h3>Why do some sections take minutes?</h3>
<p>Several checks deliberately test slow or malformed handshakes. --fast skips them, and --wide adds even more.</p>
<h3>Can I check a STARTTLS service?</h3>
<p>Yes: --starttls smtp|imap|pop3|xmpp|ftp switches protocol, which is how you audit mail servers with the same script.</p>$omp$ where slug = 'testssl-sh';

update public.pentest_tools set faqs = $omp$<h3>Is every result accurate?</h3>
<p>No. Sources may be incomplete or stale, so validate findings before reporting them.</p>
<h3>Which sources need API keys?</h3>
<p>crtsh, certspotter, otx, rapiddns and urlscan need none. Shodan, Hunter, SecurityTrails and similar read keys from api-keys.yaml.</p>
<h3>Why does Google return nothing?</h3>
<p>Google blocks automated queries quickly. Use bing, duckduckgo or crtsh instead, and keep -l modest.</p>
<h3>Is this active scanning?</h3>
<p>No - it queries third-party indexes and public sources. Nothing is sent to the target, which is why it is safe at the recon stage.</p>$omp$ where slug = 'theharvester';
update public.osint_tools set faqs = $omp$<h3>Is every result accurate?</h3>
<p>No. Sources may be incomplete or stale, so validate findings before reporting them.</p>
<h3>Which sources need API keys?</h3>
<p>crtsh, certspotter, otx, rapiddns and urlscan need none. Shodan, Hunter, SecurityTrails and similar read keys from api-keys.yaml.</p>
<h3>Why does Google return nothing?</h3>
<p>Google blocks automated queries quickly. Use bing, duckduckgo or crtsh instead, and keep -l modest.</p>
<h3>Is this active scanning?</h3>
<p>No - it queries third-party indexes and public sources. Nothing is sent to the target, which is why it is safe at the recon stage.</p>$omp$ where slug = 'theharvester';

update public.pentest_tools set faqs = $omp$<h3>Does a clean Trivy scan prove a container is secure?</h3>
<p>No. Coverage depends on the scanned artifact, enabled checks and current vulnerability data.</p>
<h3>What does it actually scan?</h3>
<p>OS packages, language dependencies from lockfiles, container image layers, IaC manifests, Kubernetes manifests and (opted in) secrets.</p>
<h3>Why a 24 hour database refresh?</h3>
<p>It downloads the vulnerability DB on first run and caches it. In air-gapped CI, mirror the DB or pass --skip-db-update with a prebuilt cache.</p>
<h3>Does it fail my build?</h3>
<p>Only with --exit-code 1. Severity thresholds (--severity HIGH,CRITICAL) then define what counts as a failure.</p>$omp$ where slug = 'trivy';

update public.pentest_tools set faqs = $omp$<h3>Should scan results be published in tickets or public logs?</h3>
<p>No. They can contain live credentials; redact them and restrict access.</p>
<h3>What does verification mean?</h3>
<p>It calls the provider with the discovered key. A live key is a real incident; an unverified string is a lead you still have to check.</p>
<h3>Will it scan my whole organisation?</h3>
<p>Per repository or per path. For org-wide coverage, run it in CI on every push and add the GitHub app or scheduled scans.</p>
<h3>Does it handle non-git sources?</h3>
<p>Yes: S3, GCS, Docker images, filesystem paths, Elasticsearch and more. Each has its own subcommand.</p>$omp$ where slug = 'trufflehog';

update public.pentest_tools set faqs = $omp$<h3>Can memory analysis always identify malware?</h3>
<p>No. Findings depend on image quality, operating-system support and available artifacts.</p>
<h3>Where do the symbols come from?</h3>
<p>Volatility 3 downloads ISF symbol packs on demand from the project's symbol server. Fetch them once in an environment with network access, then copy the cache.</p>
<h3>Why does windows.info fail?</h3>
<p>Almost always a missing or mismatched symbol pack, or an image that is not a raw memory capture. Check the file header first.</p>
<h3>Can I use my own Linux kernel?</h3>
<p>Yes, but you have to generate the symbol table (dwarf2json) from the matching kernel and put it in the symbols path.</p>$omp$ where slug = 'volatility-3';

update public.osint_tools set faqs = $omp$<h3>Do I need to install WhatsMyName?</h3>
<p>No. It runs entirely as a web page — open it, type a username, read the results.</p>
<h3>What does a hit prove?</h3>
<p>That the username exists on that site. It does not identify the person behind it; that needs corroborating evidence.</p>
<h3>Can I check several usernames at once?</h3>
<p>The web UI checks one at a time. For batches, use the project's JSON list with a script, or a CLI tool such as Sherlock or Maigret.</p>
<h3>Where does the site list come from?</h3>
<p>A community-maintained JSON file in the project repository. Sites are added and corrected by pull request, so the list is current but not exhaustive.</p>$omp$ where slug = 'whatsmyname';

update public.pentest_tools set faqs = $omp$<h3>Is Wireshark only for pentesting?</h3>
<p>No. It is also widely used for network troubleshooting, incident response and protocol analysis.</p>
<h3>Capture filter or display filter?</h3>
<p>Capture filters (pcap syntax) decide what is recorded and cannot be changed later. Display filters (-Y) filter what you see and are the ones to use daily.</p>
<h3>Why can I not see any interfaces?</h3>
<p>Permissions. Add your user to the wireshark group (or use dumpcap with capabilities) and log back in.</p>
<h3>How do I follow a TCP stream?</h3>
<p>Right-click a packet and pick Follow -> TCP Stream in the GUI, or use -z follow,tcp,ascii,0 with tshark for the same output on the command line.</p>$omp$ where slug = 'wireshark';
