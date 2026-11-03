# Backlink kit

Cost: ₹0. This is the one lever that moves a one-day-old domain, and it is the
only thing in `TRAFFIC-PLAN.md` that does not need money.

Read `TRAFFIC-PLAN.md` first for why links matter more than more pages right
now. This file is only the doing.

## The asset, stated honestly

Verified in this repository, not taken from the marketing copy:

- Six of the ten tools make **zero network calls**. The password checker,
  entropy calculator, hash/JWT inspector, URL scanner, dork builder and
  passphrase generator are pure client-side JavaScript.
- The breach check calls `api.pwnedpasswords.com` on purpose, using k-anonymity,
  so only a five-character SHA-1 prefix leaves the browser. That is the
  documented design, not a leak.
- The Academy has 118 lessons, 17 comparisons and 14 cheat sheets, all static
  HTML with structured data.

The sentence that gets a link: **"security tools that never send your password
anywhere"**. Most tools in this category cannot say that, because they work by
posting your input to a server. Before pitching it anywhere, re-read the first
bullet and make sure it is still true after any change - a false privacy claim
in a public pull request is worse than no pull request.

## Order of work

Highest chance of a real, permanent link first. Do them in this order and stop
when one lands.

### 1. Awesome lists on GitHub

The cheapest real link on the internet, and a legitimate one: these lists exist
to be contributed to. A pull request that adds one genuinely good resource is
normal and welcome.

Candidate repositories. Check each one's current `CONTRIBUTING.md` before
opening a PR - the format and the section names change, and a PR that ignores
the template gets closed without comment.

| Repository | Which section | What fits |
|---|---|---|
| `jivoi/awesome-osint` | Username checkers / Privacy | dork builder, username OSINT tools |
| `enaqx/awesome-pentest` | Password cracking / Web | password checker, hash inspector |
| `pluja/awesome-privacy` | Tools | the zero-network tools |
| `sbilly/awesome-security` | Tools | the tool hub |

Also search GitHub for `awesome cybersecurity`, `awesome privacy tools` and
`awesome web security` - there are dozens more, and the smaller lists are easier
to land. A link from a list with 400 stars is still a link.

**How to write the entry.** Match the list's existing style exactly - usually one
line, dash, link, colon, description. One line, no marketing adjectives:

```
- [OopsMyPassword](https://oopsmypassword.vercel.app) - Privacy-first password
  and OSINT tools that run entirely in the browser, plus a 118-lesson security
  academy.
```

Do not put the words "best", "free", "amazing" or an emoji in it. Maintainers
close PRs that look like advertising.

**The PR body** matters as much as the diff. Something like:

> Adds a browser-based password and OSINT toolkit. The tools run entirely
> client-side - the password checker, entropy calculator and hash inspector make
> no network requests at all, which is why I thought it belonged in this
> section. Happy to adjust the wording or move it to a better category.

**Expectation.** One in three PRs lands. That is fine; a link that lasts five
years is worth three attempts.

### 2. Directories

These send referral traffic as well as a link, and they are one form each.

- **AlternativeTo** - list the tool hub as an alternative to Have I Been Pwned's
  password check and to online password strength checkers. The differentiator
  there is the client-side claim.
- **LibHunt** - attempts to index open resources; submit the site.
- **Product Hunt** - one launch. Prepare the gallery and the first comment in
  advance, launch on a Tuesday or Wednesday, and be present for six hours.
  The first comment should explain the privacy design, not ask for upvotes.

### 3. Show HN

One post, tool first, blog never:

```
Show HN: Security tools that never send your password to a server
```

The body should be short, technical and honest about what it is not: no account,
no backend for the tools, here is how the breach check keeps k-anonymity, here
is what is still missing. Hacker News punishes adjectives and rewards a working
thing plus an honest limitation.

Realistic outcome: most Show HN posts get nothing. The ones that work do so
because the thing is genuinely novel. Yours has one novel property - the tools
run locally - so lead with that and nothing else.

### 4. Reddit, with rules

Reddit will send real traffic and will ban the account that spams. The rule that
survives: **answer for a few weeks before you ever link.**

- `r/cybersecurity` and `r/netsec` - self-promotion is restricted; a link without
  standing gets removed and repeat attempts get the account banned.
- `r/privacy` - receptive to client-side tools, hostile to anything that looks
  like a funnel. Read their wiki on self-promotion first.
- `r/India`, `r/developersIndia` - a local-audience angle works here that does
  not work anywhere else: "I built a free security academy" lands better than
  the same post in a global sub.
- `r/webdev`, `r/selfhosted` - tool posts are welcome; blog posts are not.

The version that gets removed is "check out my site". The version that survives
is a comment that answers somebody's question and happens to contain a link to
the thing that answers it.

### 5. The loop the site already has

The certificate page is the one built-in growth mechanism: someone finishes a
Cyber Security track, shares the certificate, the image carries the URL. Two
things make it work, and neither is code:

- the certificate has to look worth sharing (name, track, date, a clean design)
- there has to be a reason to finish (a shared link, a LinkedIn line)

Check the certificate page on a phone before promoting it anywhere.

## What not to do

- **Do not buy links.** Paid link networks are detectable and the penalty is
  applied to the whole domain.
- **Do not mass-post the same link.** It converts one possible community into a
  permanent ban.
- **Do not submit to list sites that accept anything** - they add no authority
  and they look like a link farm.
- **Do not claim the privacy property after breaking it.** If a tool later
  starts calling a server, every page that says otherwise becomes a liability.

## What to measure

After each attempt, record one line: date, where, what happened. That is the
only way to know which channel works for this site instead of guessing.

| Date | Where | Result |
|---|---|---|
| | | |

Three months of that table is worth more than any plan written in advance.
