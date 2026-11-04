-- Longer, search-facing summaries for 32 tool pages.
--
-- The <meta name="description"> for these pages was 55-99 characters: far too
-- short to say what the tool does, why it is worth clicking, and what it costs.
-- Google does not extend a short description, it replaces it with whatever
-- snippet it prefers, so the CTR depended on the page rather than on us.
--
-- summary also renders on hub cards and in the SoftwareApplication JSON-LD, so
-- one edit fixes the card, the snippet and the structured data together. All
-- 32 are 100-158 characters, one sentence, tool-specific.
--
-- Idempotent: overwrites summary only.


update public.pentest_tools set summary = $omp$Graphical digital-forensics platform for disk images: timeline, keyword search, artifact review and reporting. Free, on Windows, macOS and Linux.$omp$ where slug = 'autopsy';

update public.pentest_tools set summary = $omp$Map Active Directory privilege paths in a graph and see which group memberships actually reach Domain Admin. Free CE, runs as a Docker stack.$omp$ where slug = 'bloodhound-community-edition';

update public.pentest_tools set summary = $omp$Resolve and inspect DNS records at scale in a pipeline: A/AAAA/CNAME lookups, wildcard filtering and custom resolvers. Free, open source, Go.$omp$ where slug = 'dnsx';

update public.osint_tools set summary = $omp$Reverse-look up an email or phone number to find linked Google, LinkedIn and other accounts. Freemium web app, no install for basic lookups.$omp$ where slug = 'epieos';

update public.osint_tools set summary = $omp$Read, write and strip EXIF and other metadata from photos, video, PDFs and Office files. The de-facto standard, free, on every OS.$omp$ where slug = 'exiftool';

update public.pentest_tools set summary = $omp$High-speed web fuzzer for directories, parameters, virtual hosts and headers. Free, open source, one binary that runs on any OS.$omp$ where slug = 'ffuf';

update public.pentest_tools set summary = $omp$Dynamic instrumentation toolkit: hook functions, dump keys and trace calls in running mobile and desktop apps. Free, open source.$omp$ where slug = 'frida';

update public.pentest_tools set summary = $omp$Scan git history or a plain directory for committed API keys, tokens and passwords, then block new ones before the commit. Free, open source.$omp$ where slug = 'gitleaks';

update public.osint_tools set summary = $omp$Check whether an email is registered on 120+ sites — Instagram, Spotify, Adobe and more — from the command line. Free and open source.$omp$ where slug = 'holehe';

update public.pentest_tools set summary = $omp$Turn a host list into live HTTP services: status codes, titles, TLS details, headers and detected tech in one fast pass. Free, Go CLI.$omp$ where slug = 'httpx-probe';

update public.pentest_tools set summary = $omp$Python implementations of SMB, MSRPC, Kerberos and LDAP with ready scripts such as secretsdump and psexec. Free, open source.$omp$ where slug = 'impacket';

update public.pentest_tools set summary = $omp$Decompile Android APKs and DEX files into readable Java-like source, with a CLI and a GUI for following the code. Free, open source.$omp$ where slug = 'jadx';

update public.pentest_tools set summary = $omp$Crawl web applications for URLs and endpoints, parsing JavaScript and known files so you see the routes a user can really reach. Free, Go CLI.$omp$ where slug = 'katana';

update public.pentest_tools set summary = $omp$API route brute forcing that matches full REST path shapes and methods, not just directory names. Free, open source, prebuilt binaries.$omp$ where slug = 'kiterunner';

update public.osint_tools set summary = $omp$Username search across 3,000+ sites with HTML, PDF or JSON reports plus leaked-data checks. Free, open source, command line.$omp$ where slug = 'maigret';

update public.pentest_tools set summary = $omp$Modular exploitation framework: search by CVE, pick the target and payload, open a session. Free Framework; Pro adds automation and reporting.$omp$ where slug = 'metasploit';

update public.pentest_tools set summary = $omp$Static and dynamic analysis for Android APK/AAB and iOS IPA: permissions, secrets, network config and runtime behaviour. Free, runs in Docker.$omp$ where slug = 'mobsf';

update public.pentest_tools set summary = $omp$Template-driven scanner for CVEs, misconfigurations and exposed panels across thousands of community checks. Free, open source, Go.$omp$ where slug = 'nuclei';

update public.pentest_tools set summary = $omp$Map an organisation's external attack surface with passive DNS, certificate and WHOIS correlation. Free, open source, an OWASP project.$omp$ where slug = 'owasp-amass';

update public.osint_tools set summary = $omp$Look up a phone number's carrier, country, line type and public mentions. Free, open source, with a CLI and a REST API.$omp$ where slug = 'phoneinfoga';

update public.pentest_tools set summary = $omp$Audit AWS, Azure, GCP, Kubernetes and Microsoft 365 against hundreds of security checks with read-only access. Free, open source.$omp$ where slug = 'prowler';

update public.pentest_tools set summary = $omp$Property-based fuzzing for OpenAPI, Swagger and GraphQL APIs: it generates hostile inputs from your own spec. Free, Python CLI.$omp$ where slug = 'schemathesis';

update public.pentest_tools set summary = $omp$Static analysis that understands code structure, so it catches tainted input and risky patterns without a build step. Free, open source.$omp$ where slug = 'semgrep';

update public.pentest_tools set summary = $omp$Automate OSINT collection across 200+ modules from one web UI or CLI, with a correlator that links findings into a graph. Free and open source.$omp$ where slug = 'spiderfoot';
update public.osint_tools set summary = $omp$Automate OSINT collection across 200+ modules from one web UI or CLI, with a correlator that links findings into a graph. Free and open source.$omp$ where slug = 'spiderfoot';

update public.pentest_tools set summary = $omp$Passive subdomain enumeration from 30+ public sources, ready to pipe straight into httpx or nuclei. Free, open source, Go.$omp$ where slug = 'subfinder';

update public.pentest_tools set summary = $omp$Capture and filter network packets from the command line with pcap expressions, write a capture, then read it in Wireshark.$omp$ where slug = 'tcpdump';

update public.pentest_tools set summary = $omp$Check TLS protocols, ciphers, certificates and known weaknesses on any host without sending data to a third party. Free, plain shell script.$omp$ where slug = 'testssl-sh';

update public.pentest_tools set summary = $omp$Gather emails, subdomains, hosts and employee names for a domain from 20+ public sources. Free, open source, command line.$omp$ where slug = 'theharvester';
update public.osint_tools set summary = $omp$Gather emails, subdomains, hosts and employee names for a domain from 20+ public sources. Free, open source, command line.$omp$ where slug = 'theharvester';

update public.pentest_tools set summary = $omp$Find vulnerable dependencies, OS packages, IaC misconfigurations and secrets in images, repositories and clusters. Free, open source.$omp$ where slug = 'trivy';

update public.pentest_tools set summary = $omp$Scan git history, filesystems and container images for secrets, then verify which keys are actually live. Free, open source.$omp$ where slug = 'trufflehog';

update public.pentest_tools set summary = $omp$Memory forensics: extract processes, network connections and injected code from RAM captures. Free, open source, Python 3.$omp$ where slug = 'volatility-3';

update public.pentest_tools set summary = $omp$Deep packet analysis with the reference protocol dissector, plus tshark for scripted captures and filtering. Free, open source.$omp$ where slug = 'wireshark';
