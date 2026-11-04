-- Tool install guides (Pentest Hub).
--
-- Before this, 26 of the 37 published pentest tools had an install_guide of
-- one sentence and a URL ("Official downloads: <link>"). The hub page promises
-- "install steps", the structured data promises an installation guide, and the
-- page delivered neither. Every block below is a real install path for that
-- tool plus at least one first command, checked against the vendor docs.
--
-- Content lives in the database because the static publisher reads these rows
-- at build time (scripts/build-static-seo.mjs); updating the rows republishes
-- the pages. Deliberately no schema change: install_guide is already text.
--
-- Idempotent: safe to re-run, it only overwrites install_guide.


update public.pentest_tools set install_guide = $omp$<pre><code>
# Debian / Ubuntu / Kali (GUI package)
sudo apt install autopsy

# macOS / Windows
# Download the installer from https://www.autopsy.com/download/

# Launch the desktop app, then open the case UI it starts
autopsy
# -> http://localhost:9999/autopsy

# The Sleuth Kit command-line tools ship alongside it
fls -r -p evidence.dd
</code></pre>
<p>First run: File -> New Case, add the disk image, enable the ingest modules you need. Setup and module reference: https://sleuthkit.org/autopsy/docs/</p>$omp$ where slug = 'autopsy';

update public.pentest_tools set install_guide = $omp$<pre><code>
# BloodHound CE ships as a Docker stack (Docker Engine + the compose plugin)
curl -L https://ghst.ly/getbhce -o docker-compose.yml
docker compose up -d

# The first-boot admin password is printed once in the logs - copy it now
docker compose logs 2>&1 | grep -i "initial password"

# UI: http://localhost:8080/ui   (user: admin)
</code></pre>
<p>Collect data with SharpHound on a Windows host you own (or BloodHound.py from the CE download page), then upload the ZIP in the UI. Docs: https://bloodhound.specterops.io/</p>$omp$ where slug = 'bloodhound-community-edition';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Go tool - put the Go bin directory on your PATH first
go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest
export PATH="$PATH:$(go env GOPATH)/bin"

# Docker alternative
docker run --rm projectdiscovery/dnsx:latest -h

# Resolve A records and show the response
echo example.com | dnsx -a -resp

# Chain it: subdomains -> only the ones that actually resolve
subfinder -d example.com -silent | dnsx -silent -a -resp
</code></pre>
<p><code>-wd</code> drops wildcard DNS answers, which otherwise look like thousands of real subdomains. Docs: https://docs.projectdiscovery.io/tools/dnsx/overview</p>$omp$ where slug = 'dnsx';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Go (current release, no package lag)
go install github.com/ffuf/ffuf/v2@latest

# or
brew install ffuf
sudo apt install ffuf

# Directory discovery on a host you are authorized to test
ffuf -u https://lab.example.com/FUZZ -w /usr/share/seclists/Discovery/Web-Content/common.txt -mc 200,204,301,302,403

# Hide the noisy catch-all response by size
ffuf -u https://lab.example.com/FUZZ -w list.txt -fs 4242

# Fuzz a parameter value instead of a path
ffuf -u "https://lab.example.com/search?q=FUZZ" -w payloads.txt -mc all
</code></pre>
<p>FUZZ marks the injection point; <code>-mc</code> keeps only the status codes you care about. Docs: https://github.com/ffuf/ffuf</p>$omp$ where slug = 'ffuf';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Python client plus the CLI tools
python3 -m pip install --user frida-tools

# or
brew install frida

# List apps and processes on a USB-connected device
frida-ps -U

# Attach to an app and load your script
frida -U -f com.example.app -l hook.js

# Android: push frida-server for the matching architecture and run it as root
adb push frida-server /data/local/tmp/
adb shell "su -c /data/local/tmp/frida-server &"
</code></pre>
<p>Use only on apps and devices you own or have written permission to test. Docs: https://frida.re/docs/installation/</p>$omp$ where slug = 'frida';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Homebrew, a release binary, or Docker (distro packages lag behind)
brew install gitleaks
go install github.com/gitleaks/gitleaks/v8@latest

# Scan a repository's full commit history
gitleaks git /path/to/repo -v

# Scan a directory that is not a git repository
gitleaks dir ./src -v

# Write a JSON report you can attach to a ticket
gitleaks git . --report-format json --report-path gitleaks.json
</code></pre>
<p>Since 8.19 the old <code>gitleaks detect</code> command is deprecated: use <code>gitleaks git</code> or <code>gitleaks dir</code>. Add <code>--redact</code> to keep the secret values out of CI logs. Docs: https://github.com/gitleaks/gitleaks</p>$omp$ where slug = 'gitleaks';

update public.pentest_tools set install_guide = $omp$<pre><code>
# ProjectDiscovery httpx - not the Python httpx library, which also ships an `httpx`
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
export PATH="$PATH:$(go env GOPATH)/bin"

# Probe one host for status code, title and detected tech
httpx -u https://lab.example.com -status-code -title -tech-detect

# Turn a subdomain list into the live HTTP services
subfinder -d example.com -silent | httpx -silent -mc 200,302

# Show response headers and CDN/WAF fingerprints
httpx -u https://lab.example.com -headers -cdn
</code></pre>
<p>If <code>pip install httpx</code> is already on the machine, call the Go binary by full path to avoid hitting the Python one. Docs: https://docs.projectdiscovery.io/tools/httpx/overview</p>$omp$ where slug = 'httpx-probe';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Python library plus the example scripts (psexec.py, secretsdump.py, ...)
python3 -m pip install --user impacket

# isolated alternative
pipx install impacket

# Kali / Debian package
sudo apt install python3-impacket

# Dump NTLM hashes from an authorized lab host
impacket-secretsdump -just-dc-ntlm domain.local/user:'Password'@10.0.0.5

# Or run the scripts straight from a source checkout
python3 examples/psexec.py domain.local/user:'Password'@10.0.0.5
</code></pre>
<p>There is no <code>impacket</code> command on its own - every protocol is a separate script. Docs: https://github.com/fortra/impacket</p>$omp$ where slug = 'impacket';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Kali / Debian
sudo apt install jadx

# macOS
brew install jadx

# Any OS: grab the release ZIP from https://github.com/skylot/jadx/releases

# Decompile an APK to readable Java sources
jadx -d out/ app.apk

# Open the GUI instead
jadx-gui app.apk
</code></pre>
<p><code>--no-res</code> skips resources when you only want the code, and <code>--deobf</code> renames obfuscated classes to something readable. Docs: https://github.com/skylot/jadx</p>$omp$ where slug = 'jadx';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Go
go install github.com/projectdiscovery/katana/cmd/katana@latest
export PATH="$PATH:$(go env GOPATH)/bin"

# Crawl a target three levels deep, parsing JavaScript for endpoints
katana -u https://lab.example.com -d 3 -jc

# Store every URL found for later testing
katana -u https://lab.example.com -d 2 -silent -o urls.txt

# Feed a list of hosts instead of one URL
katana -list hosts.txt -silent -d 2
</code></pre>
<p><code>-jc</code> parses JavaScript and <code>-kf all</code> keeps known files such as robots.txt and sitemap.xml. Docs: https://docs.projectdiscovery.io/tools/katana/overview</p>$omp$ where slug = 'katana';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Prebuilt binary from the releases page
# https://github.com/assetnote/kiterunner/releases
# The archive already contains the wordlists/ directory
tar -xzf kiterunner_*_linux_amd64.tar.gz
sudo mv kr /usr/local/bin/

# Or build from source
git clone https://github.com/assetnote/kiterunner.git
cd kiterunner && make build && sudo cp dist/kr /usr/local/bin/

# API route brute force with the bundled kite wordlist
kr scan https://lab.example.com -w routes.kite -x 20 -j 100
</code></pre>
<p><code>kr brute</code> does plain directory brute forcing; <code>kr scan</code> matches wordlist routes against real API endpoints. Docs: https://github.com/assetnote/kiterunner</p>$omp$ where slug = 'kiterunner';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Docker is the supported install for the whole framework
docker pull opensecurity/mobile-security-framework-mobsf:latest
docker run -it --rm -p 8000:8000 opensecurity/mobile-security-framework-mobsf:latest

# UI: http://127.0.0.1:8000   (first login: mobsf / mobsf - change it)

# REST API instead of the UI
curl -X POST http://127.0.0.1:8000/api/v1/upload \
  -H "Authorization: YOUR_API_KEY" -F "file=@app.apk"
</code></pre>
<p>The REST API key is shown at the bottom of the MobSF home page. Analysis runs locally - the APK never leaves your machine. Docs: https://mobsf.github.io/docs/</p>$omp$ where slug = 'mobsf';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Go
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

# or Docker
docker run --rm projectdiscovery/nuclei:latest -h

# Templates are a separate download - fetch them first
nuclei -update-templates

# Scan one authorized target with CVE and misconfiguration templates
nuclei -u https://lab.example.com -tags cve,misconfig

# Only high and critical findings, saved to a file
nuclei -u https://lab.example.com -severity high,critical -o findings.txt
</code></pre>
<p><code>-rl</code> caps requests per second; keep it low on production-like labs. Docs: https://docs.projectdiscovery.io/tools/nuclei/overview</p>$omp$ where slug = 'nuclei';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Build from source (upstream install path)
go install -v github.com/owasp-amass/amass/v4/...@master
export PATH="$PATH:$(go env GOPATH)/bin"

# Kali / Debian
sudo apt install amass

# Passive subdomain enumeration
amass enum -d example.com

# Add brute forcing and zone walking (slow and noisy - labs only)
amass enum -active -d example.com -brute -w wordlist.txt
</code></pre>
<p>Results are written to a database by default; <code>-o subs.txt</code> also prints them, and <code>-df</code> selects a different store. Docs: https://owasp.org/www-project-amass/</p>$omp$ where slug = 'owasp-amass';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Isolated install (recommended - Prowler pins many SDK versions)
pipx install prowler

# or
python3 -m pip install --user prowler

# Docker
docker run --rm -ti toniblyx/prowler aws

# Assess a cloud account with a read-only profile
prowler aws --profile lab-readonly

# Save machine-readable reports next to the console output
prowler aws -M csv json html -o ./reports
</code></pre>
<p>Azure, GCP, Kubernetes and M365 use their own subcommands (<code>prowler azure</code>, <code>prowler gcp</code>, <code>prowler kubernetes</code>). Docs: https://docs.prowler.com/</p>$omp$ where slug = 'prowler';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Python package - the CLI is `st` (with `schemathesis` as an alias)
python3 -m pip install --user schemathesis

# or
pipx install schemathesis

# Fuzz a live API using its OpenAPI document
st run https://lab.example.com/openapi.json --checks all

# Local schema file against a local server
st run ./openapi.yaml --url http://127.0.0.1:8000

# CI-friendly: cap examples and return non-zero on failures
st run https://lab.example.com/openapi.json --max-examples 50
</code></pre>
<p><code>--stateful=links</code> chains requests (create then read then delete) to catch sequence bugs. Docs: https://schemathesis.readthedocs.io/</p>$omp$ where slug = 'schemathesis';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Python package
python3 -m pip install --user semgrep

# or
brew install semgrep

# Docker
docker run --rm -v "${PWD}:/src" semgrep/semgrep semgrep scan --config auto

# Scan the current repository with the community rules
semgrep --config auto .

# Use a published ruleset and fail CI on findings
semgrep --config p/owasp-top-ten --error ./src
</code></pre>
<p><code>--config auto</code> picks rules from the languages it detects; pin a ruleset instead for reproducible CI runs. Docs: https://semgrep.dev/docs/</p>$omp$ where slug = 'semgrep';

update public.pentest_tools set install_guide = $omp$<pre><code>
# From source (Python 3)
git clone https://github.com/smicallef/spiderfoot.git
cd spiderfoot
python3 -m pip install -r requirements.txt
python3 sf.py -l 127.0.0.1:5001

# Docker
docker run -p 5001:5001 smicallef/spiderfoot

# UI: http://127.0.0.1:5001
</code></pre>
<p>Start with a domain or IP in "New Scan", pick the modules you want, then read the graph. Most passive modules need no API key; a few improve with one. Docs: https://www.spiderfoot.net/documentation/</p>$omp$ where slug = 'spiderfoot';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Go
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
export PATH="$PATH:$(go env GOPATH)/bin"

# Docker
docker run --rm projectdiscovery/subfinder:latest -d example.com

# Passive subdomains only, one per line
subfinder -d example.com -silent

# Use every source and save the result
subfinder -d example.com -all -o example-subs.txt

# Feed straight into httpx to find live web services
subfinder -d example.com -silent | httpx -silent
</code></pre>
<p>Optional API keys go in <code>~/.config/subfinder/provider-config.yaml</code> and add sources that need them. Docs: https://docs.projectdiscovery.io/tools/subfinder/overview</p>$omp$ where slug = 'subfinder';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Debian / Ubuntu / Kali
sudo apt install tcpdump

# macOS ships an old build; Homebrew has a current one
brew install tcpdump

# Capture 20 packets on one interface, no DNS or port-name lookups
sudo tcpdump -i eth0 -nn -c 20

# Filter by host and port, and write a pcap (-w writes files; there is no -o)
sudo tcpdump -i eth0 -nn -w lab.pcap 'host 192.168.1.10 and tcp port 443'

# Read the capture back
tcpdump -nn -r lab.pcap
</code></pre>
<p>Capture only traffic on networks you own or administer. Filter syntax is pcap-filter(7), the same grammar Wireshark uses. Docs: https://www.tcpdump.org/manpages/tcpdump/</p>$omp$ where slug = 'tcpdump';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Plain shell script - nothing to compile
git clone --depth 1 https://github.com/drwetter/testssl.sh.git
cd testssl.sh
./testssl.sh https://lab.example.com

# Docker
docker run --rm -it drwetter/testssl.sh https://lab.example.com

# Only the protocol and cipher sections
./testssl.sh --protocols --server-defaults https://lab.example.com
</code></pre>
<p><code>--fast</code> skips the slow checks, <code>--jsonfile out.json</code> writes machine-readable output, and <code>--color 0</code> keeps logs clean. Docs: https://testssl.sh/</p>$omp$ where slug = 'testssl-sh';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Kali
sudo apt install theharvester

# pipx (keeps its pinned dependencies out of your system Python)
pipx install theHarvester

# From source
git clone https://github.com/laramies/theHarvester.git
cd theHarvester && pipenv install

# Sources that need no API key
theHarvester -d example.com -b crtsh,certspotter,otx,rapiddns -l 200

# Everything, into a report file
theHarvester -d example.com -b all -l 500 -f harvest.html
</code></pre>
<p><code>-d</code> is the domain, <code>-b</code> the sources, <code>-l</code> the result limit and <code>-f</code> the output file. Docs: https://github.com/laramies/theHarvester</p>$omp$ where slug = 'theharvester';

update public.pentest_tools set install_guide = $omp$<pre><code>
# macOS / Linux Homebrew
brew install trivy

# Or the release binary from https://github.com/aquasecurity/trivy/releases
# Debian/Ubuntu also have an official apt repository - see the docs link below

# Docker
docker run --rm aquasec/trivy image alpine:3.20

# Scan a container image
trivy image myapp:latest

# Scan a project directory for vulnerable dependencies and bad config
trivy fs .

# Infrastructure-as-code and secrets in one pass
trivy config . && trivy fs --scanners secret .
</code></pre>
<p>The vulnerability database is downloaded on first run and refreshed every 24 hours. Docs: https://trivy.dev/latest/docs/</p>$omp$ where slug = 'trivy';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Homebrew (Linux and macOS)
brew install trufflesecurity/trufflehog/trufflehog

# Docker
docker run --rm -it trufflesecurity/trufflehog:latest github --repo https://github.com/org/repo

# Scan a repository's full history and keep only live, verified secrets
trufflehog git https://github.com/org/repo --only-verified

# Scan a directory, or a container image
trufflehog filesystem ./path
trufflehog docker --image myapp:latest
</code></pre>
<p><code>--only-verified</code> is the difference between a usable report and a wall of false positives - it calls the provider to test each key. Docs: https://github.com/trufflesecurity/trufflehog</p>$omp$ where slug = 'trufflehog';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Isolated Python install (recommended)
pipx install volatility3

# or
python3 -m pip install --user volatility3

# Identify the memory image before anything else
vol -f memory.raw windows.info

# Processes, network connections, loaded modules
vol -f memory.raw windows.pslist
vol -f memory.raw windows.netscan
vol -f memory.raw windows.dlllist

# Linux and macOS images use their own plugin namespace
vol -f memory.raw linux.pslist
</code></pre>
<p>Symbol tables (ISF) download on demand on first use - run once with network access. Docs: https://volatility3.readthedocs.io/</p>$omp$ where slug = 'volatility-3';

update public.pentest_tools set install_guide = $omp$<pre><code>
# Debian / Ubuntu / Kali - installs the GUI, tshark and dumpcap
sudo apt install wireshark

# let your user capture without sudo, then log out and back in
sudo usermod -aG wireshark "$USER"

# macOS
brew install --cask wireshark

# Capture 10 packets from the command line
tshark -i eth0 -c 10

# Read a pcap and print the HTTP requests it contains
tshark -r lab.pcap -Y "http.request" -T fields -e http.host -e http.request.uri
</code></pre>
<p><code>-Y</code> is the display filter language, <code>-f</code> is the capture filter. Get the filter right the first time in Wireshark's own reference. Docs: https://www.wireshark.org/docs/</p>$omp$ where slug = 'wireshark';
