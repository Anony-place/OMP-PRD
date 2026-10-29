/* ============================================================
   OopsMyPassword — Google Dork & OSINT Search Query Builder
   100% client-side query composer for defensive recon, asset
   discovery, and exposure auditing. Zero telemetry.
   ============================================================ */
(function () {
  'use strict';

  var PRESETS = [
    {
      id: 'env-files',
      category: 'Secrets & Configs',
      title: 'Exposed .env Configuration Files',
      desc: 'Finds publicly indexed environment files that may leak API keys or database credentials.',
      filetype: ['env'],
      inurl: '',
      intitle: 'index of',
      intext: 'DB_PASSWORD OR APP_KEY',
      extra: ''
    },
    {
      id: 'git-folders',
      category: 'Secrets & Configs',
      title: 'Exposed .git Repositories',
      desc: 'Detects web servers accidentally serving raw .git directory trees.',
      filetype: [],
      inurl: '.git',
      intitle: 'index of /.git',
      intext: '',
      extra: ''
    },
    {
      id: 'sql-dumps',
      category: 'Secrets & Configs',
      title: 'Public SQL Database Dumps',
      desc: 'Locates indexed SQL backup files containing schema definitions or row inserts.',
      filetype: ['sql'],
      inurl: '',
      intitle: '',
      intext: 'INSERT INTO OR CREATE TABLE',
      extra: ''
    },
    {
      id: 'private-keys',
      category: 'Secrets & Configs',
      title: 'Leaked SSH / TLS Private Keys',
      desc: 'Searches for PEM or key files containing private key headers.',
      filetype: ['pem', 'log'],
      inurl: '',
      intitle: '',
      intext: 'BEGIN RSA PRIVATE KEY OR BEGIN OPENSSH PRIVATE KEY',
      extra: ''
    },
    {
      id: 'yaml-configs',
      category: 'Secrets & Configs',
      title: 'Docker Compose & CI/CD YAML Files',
      desc: 'Identifies exposed configuration manifests and pipeline definitions.',
      filetype: ['yml'],
      inurl: 'docker-compose',
      intitle: '',
      intext: 'environment OR secrets',
      extra: ''
    },
    {
      id: 'dir-listing',
      category: 'Directory & Backups',
      title: 'Open Directory Listings',
      desc: 'Finds Apache/Nginx open directory indexes on the target domain.',
      filetype: [],
      inurl: '',
      intitle: 'index of /',
      intext: 'Parent Directory',
      extra: ''
    },
    {
      id: 'backup-archives',
      category: 'Directory & Backups',
      title: 'Exposed Backup & Old Config Files',
      desc: 'Checks for .bak and .conf copies left behind during server edits.',
      filetype: ['bak', 'conf'],
      inurl: 'backup OR config',
      intitle: '',
      intext: '',
      extra: ''
    },
    {
      id: 'server-logs',
      category: 'Directory & Backups',
      title: 'Public Application & Error Logs',
      desc: 'Finds indexed .log files revealing stack traces, file paths, or session tokens.',
      filetype: ['log'],
      inurl: 'error OR debug OR access',
      intitle: '',
      intext: 'Exception OR Traceback',
      extra: ''
    },
    {
      id: 'wp-config-bak',
      category: 'Directory & Backups',
      title: 'WordPress Config & Setup Exposure',
      desc: 'Audits WordPress installations for exposed wp-config backups or setup wizards.',
      filetype: ['bak'],
      inurl: 'wp-config',
      intitle: '',
      intext: 'DB_NAME',
      extra: ''
    },
    {
      id: 's3-buckets',
      category: 'Cloud & Storage',
      title: 'AWS S3 Bucket References',
      desc: 'Searches for S3 bucket URLs or XML bucket listings associated with the target keyword.',
      filetype: [],
      inurl: 's3.amazonaws.com',
      intitle: '',
      intext: 'ListBucketResult',
      extra: ''
    },
    {
      id: 'azure-blob',
      category: 'Cloud & Storage',
      title: 'Azure Blob Storage Containers',
      desc: 'Finds public Azure blob endpoints referencing the target organization.',
      filetype: [],
      inurl: 'blob.core.windows.net',
      intitle: '',
      intext: '',
      extra: ''
    },
    {
      id: 'gcs-buckets',
      category: 'Cloud & Storage',
      title: 'Google Cloud Storage References',
      desc: 'Locates public Google Cloud Storage links and bucket listings.',
      filetype: [],
      inurl: 'storage.googleapis.com',
      intitle: '',
      intext: '',
      extra: ''
    },
    {
      id: 'admin-portals',
      category: 'Admin & Auth Portals',
      title: 'Administrative Login Portals',
      desc: 'Discovers admin consoles, staff portals, and back-office login screens.',
      filetype: [],
      inurl: 'admin OR login OR portal',
      intitle: 'Admin OR Dashboard OR Sign In',
      intext: '',
      extra: ''
    },
    {
      id: 'jira-confluence',
      category: 'Admin & Auth Portals',
      title: 'Public Jira & Confluence Instances',
      desc: 'Finds self-hosted Atlassian project boards and internal wiki pages.',
      filetype: [],
      inurl: 'jira OR confluence',
      intitle: 'System Dashboard OR Confluence',
      intext: '',
      extra: ''
    },
    {
      id: 'grafana-kibana',
      category: 'Admin & Auth Portals',
      title: 'Exposed Grafana / Prometheus / Kibana',
      desc: 'Identifies unauthenticated observability and telemetry dashboards.',
      filetype: [],
      inurl: 'grafana OR kibana OR metrics',
      intitle: 'Grafana OR Kibana',
      intext: '',
      extra: ''
    },
    {
      id: 'vpn-citrix',
      category: 'Admin & Auth Portals',
      title: 'Remote Access & VPN Gateways',
      desc: 'Locates Citrix, Fortinet, GlobalProtect, and Pulse Secure enterprise portals.',
      filetype: [],
      inurl: 'vpn OR citrix OR remote',
      intitle: 'Log In OR Gateway',
      intext: '',
      extra: ''
    },
    {
      id: 'swagger-api',
      category: 'API & Debug',
      title: 'Swagger UI & OpenAPI Specifications',
      desc: 'Finds interactive API documentation and OpenAPI JSON/YAML schemas.',
      filetype: ['json'],
      inurl: 'swagger OR api-docs OR openapi',
      intitle: 'Swagger UI',
      intext: '',
      extra: ''
    },
    {
      id: 'graphql-playground',
      category: 'API & Debug',
      title: 'GraphQL Endpoints & GraphiQL',
      desc: 'Discovers exposed GraphQL explorers and schema introspection endpoints.',
      filetype: [],
      inurl: 'graphql OR graphiql',
      intitle: 'GraphiQL OR Playground',
      intext: '',
      extra: ''
    },
    {
      id: 'phpinfo-debug',
      category: 'API & Debug',
      title: 'Exposed phpinfo() & Server Diagnostics',
      desc: 'Finds diagnostic pages leaking PHP environment variables and module versions.',
      filetype: [],
      inurl: 'phpinfo',
      intitle: 'phpinfo()',
      intext: 'PHP Version',
      extra: ''
    },
    {
      id: 'spring-actuator',
      category: 'API & Debug',
      title: 'Spring Boot Actuator Endpoints',
      desc: 'Audits Java services for exposed /actuator/health or /actuator/env routes.',
      filetype: [],
      inurl: '/actuator/',
      intitle: '',
      intext: 'heapdump OR beans OR env',
      extra: ''
    },
    {
      id: 'subdomains-enum',
      category: 'Subdomains & Docs',
      title: 'Passive Subdomain Discovery',
      desc: 'Enumerates indexed subdomains by excluding www.',
      filetype: [],
      inurl: '',
      intitle: '',
      intext: '',
      extra: '-site:www.{domain}'
    },
    {
      id: 'confidential-pdfs',
      category: 'Subdomains & Docs',
      title: 'Internal PDFs & Technical Reports',
      desc: 'Finds PDF documents marked internal, confidential, or draft.',
      filetype: ['pdf'],
      inurl: '',
      intitle: '',
      intext: 'internal use only OR confidential OR architecture',
      extra: ''
    },
    {
      id: 'spreadsheets',
      category: 'Subdomains & Docs',
      title: 'Indexed Spreadsheets & Rosters',
      desc: 'Locates public Excel workbooks that may contain contact lists or asset inventories.',
      filetype: ['xlsx'],
      inurl: '',
      intitle: '',
      intext: 'email OR department OR inventory',
      extra: ''
    },
    {
      id: 'security-txt',
      category: 'Subdomains & Docs',
      title: 'Vulnerability Disclosure & security.txt',
      desc: 'Finds security disclosure policies and bug bounty scope pages on the domain.',
      filetype: [],
      inurl: 'security.txt OR responsible-disclosure',
      intitle: '',
      intext: 'Contact:',
      extra: ''
    }
  ];

  function init() {
    var root = document.querySelector('[data-dork-app]');
    if (!root) return;

    var domainInput = document.getElementById('dork-domain');
    var excludeInput = document.getElementById('dork-exclude');
    var inurlInput = document.getElementById('dork-inurl');
    var intitleInput = document.getElementById('dork-intitle');
    var intextInput = document.getElementById('dork-intext');
    var extraInput = document.getElementById('dork-extra');
    var outputEl = document.getElementById('dork-output');
    var copyBtn = document.getElementById('dork-copy-btn');
    var resetBtn = document.getElementById('dork-reset-btn');
    var googleLink = document.getElementById('dork-open-google');
    var ddgLink = document.getElementById('dork-open-ddg');
    var githubLink = document.getElementById('dork-open-github');
    var shodanLink = document.getElementById('dork-open-shodan');
    var presetsGrid = document.getElementById('dork-presets-grid');
    var catFilterBar = document.getElementById('dork-cat-filters');
    var explainEl = document.getElementById('dork-query-explain');

    var selectedFiletypes = new Set();
    var activeCategory = 'All';

    function cleanDomain(raw) {
      return String(raw || '')
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .replace(/[^a-zA-Z0-9.-]/g, '');
    }

    function quoteIfNeeded(val) {
      var s = String(val || '').trim();
      if (!s) return '';
      if (/\sOR\s|\sAND\s/i.test(s)) return '(' + s + ')';
      if (/\s/.test(s) && !/^".*"$/.test(s)) return '"' + s.replace(/"/g, '') + '"';
      return s;
    }

    function buildQuery() {
      var parts = [];
      var explain = [];
      var dom = cleanDomain(domainInput ? domainInput.value : '');
      var targetDom = dom || 'example.com';

      if (dom) {
        parts.push('site:' + dom);
        explain.push('Restricts results to ' + dom + ' and its subdomains');
      }

      if (excludeInput && excludeInput.value.trim()) {
        var exList = excludeInput.value.trim().split(/[\s,]+/).filter(Boolean);
        exList.forEach(function (sub) {
          var cleanSub = sub.replace(/^-/, '').replace(/^site:/, '');
          if (cleanSub.indexOf('.') === -1 && dom) {
            parts.push('-site:' + cleanSub + '.' + dom);
          } else {
            parts.push('-site:' + cleanSub);
          }
        });
        explain.push('Excludes specified subdomains (' + exList.join(', ') + ')');
      }

      var fts = Array.from(selectedFiletypes);
      if (fts.length === 1) {
        parts.push('filetype:' + fts[0]);
        explain.push('Filters for .' + fts[0] + ' files');
      } else if (fts.length > 1) {
        parts.push('(' + fts.map(function (f) { return 'filetype:' + f; }).join(' OR ') + ')');
        explain.push('Filters for file extensions: ' + fts.join(', '));
      }

      if (inurlInput && inurlInput.value.trim()) {
        var uVal = inurlInput.value.trim();
        if (/\sOR\s/i.test(uVal)) {
          var uTokens = uVal.split(/\s+OR\s+/i).map(function (t) { return 'inurl:' + quoteIfNeeded(t); });
          parts.push('(' + uTokens.join(' OR ') + ')');
        } else {
          parts.push('inurl:' + quoteIfNeeded(uVal));
        }
        explain.push('URL path must contain: ' + uVal);
      }

      if (intitleInput && intitleInput.value.trim()) {
        var tVal = intitleInput.value.trim();
        if (/\sOR\s/i.test(tVal)) {
          var tTokens = tVal.split(/\s+OR\s+/i).map(function (t) { return 'intitle:' + quoteIfNeeded(t); });
          parts.push('(' + tTokens.join(' OR ') + ')');
        } else {
          parts.push('intitle:' + quoteIfNeeded(tVal));
        }
        explain.push('Page <title> must match: ' + tVal);
      }

      if (intextInput && intextInput.value.trim()) {
        var xVal = intextInput.value.trim();
        if (/\sOR\s/i.test(xVal)) {
          var xTokens = xVal.split(/\s+OR\s+/i).map(function (t) { return 'intext:' + quoteIfNeeded(t); });
          parts.push('(' + xTokens.join(' OR ') + ')');
        } else {
          parts.push('intext:' + quoteIfNeeded(xVal));
        }
        explain.push('Page body text must include: ' + xVal);
      }

      if (extraInput && extraInput.value.trim()) {
        var rawExtra = extraInput.value.trim().replace(/\{domain\}/g, targetDom);
        parts.push(rawExtra);
        explain.push('Custom operator: ' + rawExtra);
      }

      var finalQuery = parts.length ? parts.join(' ') : 'site:' + targetDom + ' intitle:"index of"';
      if (outputEl) outputEl.textContent = finalQuery;

      if (explainEl) {
        explainEl.textContent = explain.length
          ? 'Active filters: ' + explain.join(' · ')
          : 'Default preview shown. Enter a domain or choose a preset below to customize operators.';
      }

      var encoded = encodeURIComponent(finalQuery);
      if (googleLink) googleLink.href = 'https://www.google.com/search?q=' + encoded;
      if (ddgLink) ddgLink.href = 'https://duckduckgo.com/?q=' + encoded;
      if (githubLink) githubLink.href = 'https://github.com/search?q=' + encodeURIComponent(dom ? dom + ' ' + (intextInput ? intextInput.value : '') : finalQuery) + '&type=code';
      if (shodanLink) shodanLink.href = 'https://www.shodan.io/search?query=' + encodeURIComponent(dom ? 'hostname:' + dom : finalQuery);
    }

    // Bind filetype buttons
    var ftButtons = root.querySelectorAll('[data-filetype]');
    ftButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ft = btn.getAttribute('data-filetype');
        if (selectedFiletypes.has(ft)) {
          selectedFiletypes.delete(ft);
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        } else {
          selectedFiletypes.add(ft);
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        }
        buildQuery();
      });
    });

    function syncFiletypeButtons() {
      ftButtons.forEach(function (btn) {
        var ft = btn.getAttribute('data-filetype');
        var on = selectedFiletypes.has(ft);
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function applyPreset(preset) {
      selectedFiletypes.clear();
      (preset.filetype || []).forEach(function (f) { selectedFiletypes.add(f); });
      syncFiletypeButtons();
      if (inurlInput) inurlInput.value = preset.inurl || '';
      if (intitleInput) intitleInput.value = preset.intitle || '';
      if (intextInput) intextInput.value = preset.intext || '';
      if (extraInput) extraInput.value = preset.extra || '';
      buildQuery();
    }

    function renderPresets() {
      if (!presetsGrid) return;
      var filtered = PRESETS.filter(function (p) {
        return activeCategory === 'All' || p.category === activeCategory;
      });
      presetsGrid.innerHTML = filtered.map(function (p) {
        return (
          '<article class="card card-pad dork-preset-card" style="display:flex;flex-direction:column;justify-content:space-between;gap:12px">' +
            '<div>' +
              '<div class="small muted" style="font-weight:600;margin-bottom:4px">' + p.category + '</div>' +
              '<h3 class="h-3" style="font-size:1.02rem;margin:0">' + p.title + '</h3>' +
              '<p class="muted small mt-8" style="margin-bottom:0">' + p.desc + '</p>' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:8px;border-top:1px solid var(--border)">' +
              '<code class="small mono" style="color:var(--purple);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%">' +
                (p.inurl ? 'inurl:' + p.inurl + ' ' : '') +
                (p.filetype && p.filetype.length ? 'filetype:' + p.filetype[0] + ' ' : '') +
                (p.intitle ? 'intitle:' + p.intitle : '') +
              '</code>' +
              '<button type="button" class="btn btn-secondary btn-sm" data-preset-id="' + p.id + '">Load Dork</button>' +
            '</div>' +
          '</article>'
        );
      }).join('');

      presetsGrid.querySelectorAll('[data-preset-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-preset-id');
          var found = PRESETS.find(function (x) { return x.id === id; });
          if (found) {
            applyPreset(found);
            if (outputEl) outputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      });
    }

    if (catFilterBar) {
      var cats = ['All', 'Secrets & Configs', 'Directory & Backups', 'Cloud & Storage', 'Admin & Auth Portals', 'API & Debug', 'Subdomains & Docs'];
      catFilterBar.innerHTML = cats.map(function (c) {
        var active = c === activeCategory;
        return '<button type="button" class="btn btn-sm ' + (active ? 'btn-primary' : 'btn-ghost') + '" data-dork-cat="' + c + '">' + c + '</button>';
      }).join('');
      catFilterBar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-dork-cat]');
        if (!btn) return;
        activeCategory = btn.getAttribute('data-dork-cat');
        catFilterBar.querySelectorAll('[data-dork-cat]').forEach(function (b) {
          var on = b.getAttribute('data-dork-cat') === activeCategory;
          b.className = 'btn btn-sm ' + (on ? 'btn-primary' : 'btn-ghost');
        });
        renderPresets();
      });
    }

    [domainInput, excludeInput, inurlInput, intitleInput, intextInput, extraInput].forEach(function (el) {
      if (el) el.addEventListener('input', buildQuery);
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = outputEl ? outputEl.textContent : '';
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            copyBtn.textContent = 'Copied!';
            setTimeout(function () { copyBtn.textContent = 'Copy Query'; }, 1600);
          });
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (domainInput) domainInput.value = '';
        if (excludeInput) excludeInput.value = '';
        if (inurlInput) inurlInput.value = '';
        if (intitleInput) intitleInput.value = '';
        if (intextInput) intextInput.value = '';
        if (extraInput) extraInput.value = '';
        selectedFiletypes.clear();
        syncFiletypeButtons();
        buildQuery();
      });
    }

    renderPresets();
    buildQuery();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
