/* OopsMyPassword Security Academy content registry.
   UI is data-driven: add categories/topics here without duplicating templates. */
window.OMPLearningData = {
  categories: [
    {
      slug:"web-application-security", name:"Web Application Security",
      description:"Core web vulnerabilities, secure design concepts, and practical ways to reason about application security.",
      topics:[
        ["xss","XSS","Learn how untrusted input can become executable browser content and how defenses break the chain.","Beginner",18],
        ["idor-bola","IDOR / BOLA","Understand object-level authorization failures and how to reason about resource access controls.","Beginner",16],
        ["sql-injection","SQL Injection","Learn how unsafe query construction creates data-layer injection risk and how parameterization prevents it.","Beginner",18],
        ["csrf","CSRF","Understand cross-site request forgery, browser trust boundaries, and modern mitigations.","Beginner",14],
        ["ssrf","SSRF","Learn the server-side request forgery trust model and the defensive controls that limit outbound access.","Intermediate",18],
        ["ssti","SSTI","Understand server-side template injection concepts, detection signals, and safe remediation.","Intermediate",18],
        ["file-upload","File Upload","Learn why unrestricted uploads are dangerous and how storage, parsing, and execution boundaries matter.","Intermediate",16],
        ["xxe","XXE","Understand unsafe XML parser behavior and defensive parser configuration.","Intermediate",14],
        ["open-redirect","Open Redirect","Learn how redirect parameters can be abused and how allowlists prevent unsafe navigation.","Beginner",10],
        ["cors","CORS","Understand browser cross-origin policy, server headers, credentials, and common configuration mistakes.","Beginner",14],
        ["authentication","Authentication","Learn the core properties of secure login, sessions, MFA, recovery, and credential handling.","Beginner",18],
        ["access-control","Access Control","Understand authorization models, least privilege, and object/function-level access checks.","Beginner",18]
      ]
    },
    {
      slug:"api-security", name:"API Security",
      description:"Security fundamentals for REST, JWT, OAuth, GraphQL, and modern API authorization models.",
      topics:[
        ["api-fundamentals","API Fundamentals","Understand API request/response models, trust boundaries, and common API attack surfaces.","Beginner",14],
        ["api-authentication","API Authentication","Learn token-based authentication patterns and how authentication differs from authorization.","Beginner",16],
        ["bola","BOLA","Understand broken object level authorization in API resources and how to enforce ownership.","Beginner",14],
        ["broken-authentication","Broken Authentication","Learn common API authentication design failures and practical defensive controls.","Intermediate",16],
        ["mass-assignment","Mass Assignment","Understand unsafe binding of client-controlled fields to privileged server-side models.","Intermediate",14],
        ["jwt-security","JWT Security","Learn JWT structure, validation, signing, expiry, audience, and key-management concerns.","Intermediate",16],
        ["oauth","OAuth","Understand OAuth roles, flows, redirect URIs, PKCE, and the security boundaries between components.","Intermediate",20],
        ["rate-limiting","Rate Limiting","Learn why APIs need abuse controls and how rate limits interact with authentication and resource cost.","Beginner",12],
        ["graphql-security","GraphQL Security","Understand query complexity, authorization, introspection, and resolver-level security.","Intermediate",16]
      ]
    },
    {
      slug:"android-security", name:"Android Security",
      description:"Foundational Android security concepts for APK review, app components, storage, WebView, and API trust.",
      topics:[
        ["android-fundamentals","Android Fundamentals","Learn Android app structure, package identity, components, permissions, and the security model.","Beginner",18],
        ["apk-analysis","APK Analysis","Understand APK anatomy, signing, resources, manifests, and safe static analysis workflows.","Beginner",16],
        ["android-manifest","Android Manifest","Learn how manifest declarations expose app capabilities and component security boundaries.","Beginner",12],
        ["insecure-storage","Insecure Storage","Understand risks from storing secrets, tokens, and sensitive data in inappropriate locations.","Beginner",14],
        ["exported-components","Exported Components","Learn why exported Activities, Services, Receivers, and Providers need explicit trust boundaries.","Intermediate",16],
        ["deep-links","Deep Links","Understand intent routing, URI validation, and authorization risks in app links and custom schemes.","Intermediate",14],
        ["webview-security","WebView Security","Learn safe WebView configuration, JavaScript bridges, URL handling, and content isolation.","Intermediate",18],
        ["ssl-tls","SSL / TLS","Understand certificate validation, platform trust stores, and common transport-security mistakes.","Beginner",16],
        ["api-security","API Security","Learn how Android clients interact with APIs and why client-side secrets and authorization assumptions fail.","Beginner",14]
      ]
    },
    {
      slug:"recon-osint", name:"Recon & OSINT",
      description:"Asset discovery and public-information analysis with an emphasis on scope, accuracy, and safe research.",
      topics:[
        ["passive-recon","Passive Recon","Learn how to collect publicly available target information without directly probing the target.","Beginner",12],
        ["subdomain-enumeration","Subdomain Enumeration","Understand subdomain discovery sources, validation, and false-positive handling.","Beginner",14],
        ["dns-recon","DNS Recon","Learn DNS records, delegation, resolution, and what metadata can reveal about infrastructure.","Beginner",14],
        ["technology-fingerprinting","Technology Fingerprinting","Understand how headers, HTML, assets, and public metadata reveal technology choices.","Beginner",12],
        ["asset-discovery","Asset Discovery","Learn how to build and normalize an asset inventory before security testing.","Beginner",14],
        ["metadata","Metadata","Understand metadata leakage in public files and what it can reveal about systems or workflows.","Beginner",10],
        ["public-exposure","Public Exposure","Learn how to identify accidental exposure in public repositories, storage, documentation, and services.","Beginner",14]
      ]
    },
    {
      slug:"network-security", name:"Network Security",
      description:"Networking foundations and service-security concepts that support responsible security testing.",
      topics:[
        ["tcp-ip-basics","TCP/IP Basics","Learn the network layers, addressing, transport protocols, and why the basics matter for security.","Beginner",18],
        ["ports-services","Ports & Services","Understand ports, listeners, service identification, and common exposure patterns.","Beginner",12],
        ["nmap-fundamentals","Nmap Fundamentals","Learn safe network discovery concepts and how scan results map to service exposure.","Beginner",16],
        ["service-enumeration","Service Enumeration","Understand how defenders and authorized testers characterize exposed services and versions.","Intermediate",16],
        ["ssh","SSH","Learn SSH architecture, authentication, host keys, and secure configuration.","Beginner",14],
        ["ftp","FTP","Understand why legacy FTP is risky and what secure replacements look like.","Beginner",10],
        ["smb","SMB","Learn SMB concepts, trust boundaries, shares, and common defensive controls.","Intermediate",14],
        ["tls","TLS","Understand certificates, handshakes, trust stores, and the goals of transport encryption.","Beginner",16]
      ]
    },
    {
      slug:"cloud-security", name:"Cloud Security",
      description:"Core cloud-security concepts across identity, storage, and major cloud platforms.",
      topics:[
        ["cloud-fundamentals","Cloud Fundamentals","Understand shared responsibility, regions, services, and cloud trust boundaries.","Beginner",14],
        ["iam","IAM","Learn identities, roles, policies, least privilege, and why cloud authorization is central to security.","Beginner",18],
        ["s3-security","S3 Security","Understand object storage permissions, bucket policies, and public exposure risks.","Beginner",14],
        ["cloud-storage-exposure","Cloud Storage Exposure","Learn how public buckets and storage endpoints become accidental data exposure paths.","Beginner",12],
        ["aws-basics","AWS Basics","Build foundational AWS concepts needed to reason about security controls.","Beginner",18],
        ["azure-basics","Azure Basics","Build foundational Azure concepts needed to reason about identity and resource security.","Beginner",18],
        ["gcp-basics","GCP Basics","Build foundational Google Cloud concepts needed to reason about resource and identity security.","Beginner",18]
      ]
    },
    {
      slug:"client-side-security", name:"Client-Side Security",
      description:"Browser-side security concepts covering DOM risks, framing, content policy, messaging, and JavaScript isolation.",
      topics:[
        ["dom-security","DOM Security","Understand how browser-side data flows can turn unsafe input into security impact.","Beginner",14],
        ["xss","XSS","Learn client-side XSS concepts, trust boundaries, and output-encoding defenses.","Beginner",18],
        ["clickjacking","Clickjacking","Understand UI redress attacks and browser defenses such as framing controls.","Beginner",10],
        ["csp","CSP","Learn Content Security Policy concepts, directives, deployment strategy, and common gaps.","Intermediate",16],
        ["postmessage","postMessage","Understand cross-window messaging, origin validation, and safe message handling.","Intermediate",14],
        ["prototype-pollution","Prototype Pollution","Learn how unsafe object merging can affect JavaScript application behavior and defensive patterns.","Intermediate",16]
      ]
    }
  ],
  defaultLessonSections: [
    ["overview","Overview"],["how-it-works","How It Works"],["history","History / Background"],
    ["real-world","Real-World Examples"],["look-for","What To Look For"],["defensive","Defensive Perspective"],
    ["labs","Legal Practice Labs"],["quiz","Knowledge Quiz"]
  ]
};