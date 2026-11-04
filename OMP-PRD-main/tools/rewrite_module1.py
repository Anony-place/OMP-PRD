#!/usr/bin/env python3
"""Rewrite module 1 of the Academy as lessons that teach.

The lessons were revision notes: five bullet lists, no worked example, no
narrative, no statement of what the reader would be able to do afterwards.
These seven are written as a lesson: what it is in plain words, how it works,
one worked example you can follow, the mistake beginners make, and something
small to do right now.
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
CAT = ROOT / "assets/data/academy-catalogue.json"

def para(t): return {"type": "paragraph", "text": t}
def bullets(items): return {"type": "list", "items": items}
def code(text, language="http"): return {"type": "code", "text": text, "language": language}

LESSONS = {}

# ---------------------------------------------------------------- lesson 1
LESSONS["what-is-cyber-security"] = {
    "overview": "Security is not a product you install. It is a set of decisions about what you cannot afford to lose, and what you are willing to do about it. Almost everything else in this course is a detail of those decisions.",
    "outcomes": [
        "explain what security is protecting, in your own words",
        "apply the four questions that every security decision comes back to",
        "tell the difference between a bug and a security problem",
    ],
    "practice_guidance": "You do not need a lab for this lesson. Open a notes app and write the five things you would most hate to lose, then work through the Try it section. Everything stays on your device.",
    "sections": [
        {"id": "plain", "title": "In plain English", "blocks": [
            para("Imagine a small bakery. It depends on three things: the recipes that make its bread, the list of customers who order every week, and the card machine that takes payment."),
            para("Any of those three can fail. A rival could copy the recipes. A customer list could end up somewhere public. The card machine could be down on the busiest morning of the week."),
            para("Security is the work of noticing those three things, deciding what would be worst, and doing something sensible about it before it happens. Nothing about that definition requires a computer. Computers simply make it faster, bigger and harder to see."),
        ]},
        {"id": "how", "title": "How it works", "blocks": [
            para("Every security situation, from a bakery to a bank, can be described with the same four words. You will meet them again in lesson four, but they are worth hearing now because they organise everything."),
            bullets([
                "An asset is something you would be upset to lose: data, money, a laptop, the ability to take payment.",
                "A threat is whatever could take it from you: an attacker, a mistake, a fire, a failing disk.",
                "A vulnerability is the gap that lets the threat succeed: a shared password, an unpatched server, a door that does not lock.",
                "A control is the specific thing you do about it: encryption, a backup, a lock, a rule.",
            ]),
            para("Security work is a loop over those four words. Decide what matters. Ask what could go wrong. Put a control in place. Then check that the control still works — because the last step is the one everyone skips, and it is the only one that catches a control that quietly stopped working."),
        ]},
        {"id": "example", "title": "A worked example", "blocks": [
            para("Take the bakery and run the loop over it. Each line is one decision, and each decision is small enough to actually make."),
            bullets([
                "Customer list → a former employee still has access → the shared drive is open to anyone with the link → remove the ex-employee's access and stop using link sharing.",
                "Card machine → the provider has an outage → nothing on our side can fix it → keep a manual card terminal and write down what to do during an outage.",
                "Recipes → a competitor copies them → they sit in an unlocked drawer → lock the drawer, and keep the digital copies in one folder with restricted access.",
            ]),
            para("Notice that none of those fixes is dramatic, and none of them is a product you buy. That is what most real security looks like."),
        ]},
        {"id": "mistake", "title": "The mistake most beginners make", "blocks": [
            para("People start with the tool instead of the asset. They buy antivirus, or a firewall, or a password manager, and only afterwards wonder what it was supposed to protect."),
            para("The other common mistake is the sentence \"we have nothing worth stealing\". Almost every organisation has a customer list, an email account, or a payment method — and all three are worth money to somebody, which is exactly how automated attacks find them."),
        ]},
        {"id": "try", "title": "Try it in two minutes", "blocks": [
            para("Write down five things you would genuinely hate to lose — think about your own accounts, not a company's. For each one, answer two questions:"),
            bullets([
                "If this disappeared today, what would actually happen this week?",
                "If it were copied or seen by someone else, would I know?",
            ]),
            para("If the answer to the second question is \"no\", you have found the thing to work on first. Not the most valuable asset — the one you would not notice losing."),
        ]},
        {"id": "defensive", "title": "Key takeaways", "blocks": [
            bullets([
                "Security is decisions about assets, not a product you install.",
                "Asset, threat, vulnerability, control — every situation fits those four words.",
                "The loop ends with verification, and verification is the step most people skip.",
                "Start from what you would hate to lose, and from what you would not notice losing.",
            ]),
        ]},
    ],
}

# ---------------------------------------------------------------- lesson 2
LESSONS["cybersecurity-vs-information-security"] = {
    "overview": "\"Cyber security\" and \"information security\" are used as if they were the same thing. They are not, and the difference tells you what a plan has to cover.",
    "outcomes": [
        "define information security and cyber security without using each other's words",
        "classify a given risk as information, cyber, or both",
        "explain why a plan that only covers computers is incomplete",
    ],
    "practice_guidance": "No tools needed. Take three pieces of information you handle in a normal week and write down where each one physically lives.",
    "sections": [
        {"id": "plain", "title": "In plain English", "blocks": [
            para("Information security protects information wherever it is: on paper, in a conversation, on a whiteboard, in someone's head. Cyber security protects the computers and networks that carry information."),
            para("Every cyber security problem is also an information security problem, because computers hold information. But not every information security problem is a cyber problem. A salary sheet left on a printer is an information security problem with nothing cyber about it."),
        ]},
        {"id": "how", "title": "How it works", "blocks": [
            para("The two fields ask the same three things — is it available, is it correct, is it private — but they answer with different tools."),
            bullets([
                "Information security answers with cabinets, lockable rooms, clear rules about who may speak to whom, and paper trails.",
                "Cyber security answers with encryption, access control, logging, network boundaries and patching.",
                "Both answer to the same management question: what are we protecting, and who is allowed to touch it?",
            ]),
            para("That is why a serious security programme is not run by a single team. The person who controls physical keys and the person who controls cloud permissions are protecting the same asset from two directions."),
        ]},
        {"id": "example", "title": "A worked example", "blocks": [
            para("One employee file, in three different places. Same information, different discipline:"),
            bullets([
                "A paper file in a locked cabinet, in an office with a door code. Information security only. Nobody needs a firewall to protect it.",
                "The same file on a shared drive, readable by everyone in the company. Both. The rule about who may read it is information security; the permissions that enforce it are cyber security.",
                "The same file in an email attachment sent to a personal address. Both, and now the cyber failure — it left the boundary — decided the information outcome.",
            ]),
            para("In practice the third one is how most real incidents start: not a clever attacker, just information leaving a boundary that nobody was watching."),
        ]},
        {"id": "mistake", "title": "The mistake most beginners make", "blocks": [
            para("Treating the words as interchangeable, then building a plan that only covers computers. Such a plan has nothing to say about a printed sheet left in a meeting room, a phone call to the wrong person, or a laptop screen on a train."),
            para("The reverse mistake is just as common in small organisations: \"we don't have cyber security\" — said while holding a phone that has email, a customer list and a payment app on it."),
        ]},
        {"id": "try", "title": "Try it in two minutes", "blocks": [
            para("Pick three pieces of information you handled this week. For each, write where it lives and who can reach it:"),
            bullets([
                "Where does it physically or digitally sit right now?",
                "Who could read it without asking you?",
                "Would you find out if they did?",
            ]),
            para("Anything that lives on a computer is now in cyber territory. Anything that does not is still information security, and still your problem."),
        ]},
        {"id": "defensive", "title": "Key takeaways", "blocks": [
            bullets([
                "Information security protects information; cyber security protects the machines that carry it.",
                "All cyber problems are information problems; not all information problems are cyber.",
                "A plan that only covers computers leaves out paper, speech and screens.",
                "Most incidents start with information crossing a boundary nobody was watching.",
            ]),
        ]},
    ],
}

# ---------------------------------------------------------------- lesson 3
LESSONS["cia-triad"] = {
    "overview": "Confidentiality, integrity and availability are the three questions you can ask about any system. They are not a checklist to pass; they are a way to find out which one you have been ignoring.",
    "outcomes": [
        "name the three goals and the question each one asks",
        "look at a real account and say which goal is weakest",
        "explain why improving one goal can make another worse",
    ],
    "practice_guidance": "Choose one account you use daily and answer the three questions about it on paper. No tools, no sign-in needed.",
    "sections": [
        {"id": "plain", "title": "In plain English", "blocks": [
            para("Ask three questions about any piece of information, and you have the whole of the CIA triad. They are short enough to memorise, and they cover almost every security failure you will ever read about."),
            para("Here they are, in the order that makes them easiest to remember:"),
            bullets([
                "Can the people who need it get it, when they need it? That is availability.",
                "Is it still correct, and did it arrive unchanged? That is integrity.",
                "Has anyone else seen it, or could they? That is confidentiality.",
            ]),
            para("Most people think of security as the third question only — keeping secrets. The other two cause more visible damage, more often."),
        ]},
        {"id": "how", "title": "How it works", "blocks": [
            para("The three goals pull against each other, and that tension is the useful part."),
            bullets([
                "More backups improve availability, but every extra copy is another place the data can leak from — so confidentiality gets harder.",
                "More access checks improve confidentiality, but a bad access rule can lock out the person who needs the data at 3am — so availability suffers.",
                "Faster sync improves availability, but if it copies a corrupted value everywhere before anyone notices, integrity suffers.",
            ]),
            para("Good security is not maximising all three. It is deciding, for this particular system, which one you would sacrifice first — and writing that decision down so it is a decision and not an accident."),
        ]},
        {"id": "example", "title": "A worked example", "blocks": [
            para("Your bank account, failure by failure:"),
            bullets([
                "The balance shows 0 because a transfer posted twice. Availability is fine, confidentiality is fine, integrity is broken. You can log in and see a wrong number.",
                "The app will not load on payday. Availability is broken, the other two are intact.",
                "Your statement is visible inside someone else's app after a bug. Confidentiality is broken, and the other two look perfectly normal — which is why this one can go unnoticed for months.",
            ]),
            para("Three different failures, three different responses. A plan that only ever asks \"is it secret?\" has no answer for the first two."),
        ]},
        {"id": "mistake", "title": "The mistake most beginners make", "blocks": [
            para("Assuming confidentiality is the only goal, so any problem that does not involve a leak is not a security problem. A hospital whose records cannot be opened during an emergency is having a security incident, whether or not anything leaked."),
            para("The second mistake is assuming you can improve all three for free. You cannot; every control you add trades one against another, and the job is to know which trade you made."),
        ]},
        {"id": "try", "title": "Try it in two minutes", "blocks": [
            para("Take one account you use every day — email is a good choice — and answer three questions honestly:"),
            bullets([
                "If it were unavailable for a day, what would break?",
                "If one message were silently changed, would you notice?",
                "Who else could read it right now, including the provider?",
            ]),
            para("Whichever answer made you least comfortable is the goal to work on. For most people it is the third, and the fix is usually two-factor authentication rather than anything more complicated."),
        ]},
        {"id": "defensive", "title": "Key takeaways", "blocks": [
            bullets([
                "Availability: can the right people get it? Integrity: is it still correct? Confidentiality: who else can see it?",
                "Confidentiality is the goal people think of first and the one whose failures are noticed last.",
                "The three goals trade against each other; a control that improves one usually costs another.",
                "Decide which goal you would sacrifice first, deliberately, and write it down.",
            ]),
        ]},
    ],
}

# ---------------------------------------------------------------- lesson 4
LESSONS["assets-threats-vulnerabilities-and-risk"] = {
    "overview": "Four words carry the whole of security: asset, threat, vulnerability, risk. Get them in the right slots and most arguments about security become much shorter.",
    "outcomes": [
        "define each of the four words with an example of your own",
        "take one system and fill all four slots for it",
        "explain why a threat is not the same thing as a vulnerability",
    ],
    "practice_guidance": "Pick one system you actually use — a phone, a website, a shared folder — and fill in the four words on paper.",
    "sections": [
        {"id": "plain", "title": "In plain English", "blocks": [
            para("Think about a bicycle you park on the street."),
            bullets([
                "The bicycle is the asset: the thing you would hate to lose.",
                "A thief is the threat: whatever could take it.",
                "The cable lock that takes nine seconds to cut is the vulnerability.",
                "The risk is how likely it is that those three meet — which depends on where you park, what the bike is worth, and how long you leave it.",
            ]),
            para("Risk is not a fourth object in the list. It is the answer to \"so what?\" — the combination of how likely the loss is and how much it would hurt."),
        ]},
        {"id": "how", "title": "How it works", "blocks": [
            para("The reason the four words matter is that each one leads to a different fix, and people usually reach for the wrong one."),
            bullets([
                "If the asset is not worth much, stop here. Removing the asset is a legitimate control and the cheapest one available.",
                "If the threat can be avoided, avoid it. A service you do not run cannot be attacked.",
                "If the vulnerability can be closed, close it — patching, a stronger lock, a fixed permission.",
                "If none of those work, reduce the impact: insurance, backups, monitoring, and a plan for the day it happens.",
            ]),
            para("Notice that \"buy a firewall\" is only one of those options, and not usually the first."),
        ]},
        {"id": "example", "title": "A worked example", "blocks": [
            para("A small online shop, described in the same four words:"),
            bullets([
                "Asset: the customer database, including email addresses and order history.",
                "Threat: automated credential stuffing — bots replaying leaked email and password pairs from other breaches.",
                "Vulnerability: the login page has no rate limit, and there is no second factor, so a leaked password is enough.",
                "Risk: high, because the attack is automated, cheap, and does not need to know anything about this particular shop.",
            ]),
            para("The fix follows from the vulnerability, not from the threat. You cannot stop bots existing. You can rate-limit logins and require a second factor, which turns a cheap automated attack into an expensive manual one."),
        ]},
        {"id": "mistake", "title": "The mistake most beginners make", "blocks": [
            para("Confusing a threat with a vulnerability. \"Hackers\" is a threat; \"our admin panel has no password\" is a vulnerability. You cannot fix the first, and you can fix the second today."),
            para("The other mistake is treating risk as a yes-or-no. Every system has some risk. The question is whether the risk is understood, accepted and priced — not whether it exists."),
        ]},
        {"id": "try", "title": "Try it in two minutes", "blocks": [
            para("Choose one system you use — a phone, a folder, a website — and write four lines:"),
            bullets([
                "Asset: what specifically would I lose?",
                "Threat: who or what could cause that?",
                "Vulnerability: what specific gap lets them succeed?",
                "Risk: how likely is it, and how much would it cost me?",
            ]),
            para("If you cannot name a specific vulnerability, you have not found it yet — and that is the line to go and look at properly."),
        ]},
        {"id": "defensive", "title": "Key takeaways", "blocks": [
            bullets([
                "Asset, threat, vulnerability — three different things, three different fixes.",
                "Risk is likelihood times impact, not a yes-or-no question.",
                "You cannot remove a threat, but you can usually close a vulnerability.",
                "Removing or not holding the asset is a real control, and often the cheapest.",
            ]),
        ]},
    ],
}

# ---------------------------------------------------------------- lesson 5
LESSONS["attack-surface-and-attack-vectors"] = {
    "overview": "The attack surface is everything an attacker can touch; the attack vector is the particular route they use. One is a measurement, the other is a story about how it happened.",
    "outcomes": [
        "list the ways into a system you already run or use",
        "distinguish the surface from a single vector",
        "spot the entry point people forget: the one that is not yours",
    ],
    "practice_guidance": "Open a site you run or a service you use and list, on paper, every way in. Do not test anything you do not own.",
    "sections": [
        {"id": "plain", "title": "In plain English", "blocks": [
            para("A house has a front door, a back door, windows, a loft hatch, a letterbox and a chimney. All of that together is the attack surface: the total set of ways in."),
            para("If somebody climbs in through the kitchen window, that window was the attack vector: the one route actually used, on that night."),
            para("The surface is what you count and reduce. The vector is what you read about afterwards. Confusing them is why people harden the front door and leave the loft hatch open."),
        ]},
        {"id": "how", "title": "How it works", "blocks": [
            para("Every entry point you add — a login form, an API, an upload field, a plugin, a contractor's access — enlarges the surface. That is not an argument against building things. It is an argument for knowing what you added."),
            bullets([
                "Each way in is a promise you have to keep: it must authenticate, validate, log and be patched.",
                "Surface that nobody owns is the dangerous kind: an old staging server, a forgotten subdomain, a test key left in code.",
                "You cannot reduce the surface to zero. You can make it smaller than last month, and you can know what is on it.",
            ]),
            para("A useful habit: for every new feature, ask \"what did we just expose?\" before asking \"does it work?\"."),
        ]},
        {"id": "example", "title": "A worked example", "blocks": [
            para("An imaginary small business with a website, counted honestly:"),
            bullets([
                "The public site and its login form.",
                "The admin panel — the same site, a different path, often weaker.",
                "The API the mobile app talks to.",
                "The mailbox everyone uses for support and password resets.",
                "Six employee laptops and the personal phones they check email on.",
                "A third-party chat widget loaded from someone else's server.",
                "A staging copy from last year, still online, still with the default admin password.",
            ]),
            para("Seven entries, and a typical owner would have listed two. The last one is the important one: it is not something the business built recently, it is something it forgot."),
        ]},
        {"id": "mistake", "title": "The mistake most beginners make", "blocks": [
            para("Assuming the attack surface is only what your own team built. Third-party scripts, plugins, contractors and old staging environments are all part of it — and all of them are usually weaker than the thing you are carefully testing."),
            para("The second mistake is counting entries you can see and ignoring the ones you cannot: subdomains nobody remembers, an API version still serving requests, an old employee's account that still works."),
        ]},
        {"id": "try", "title": "Try it in two minutes", "blocks": [
            para("Take one service you use and list every way in, including the boring ones:"),
            bullets([
                "The main login page.",
                "Any admin or staff area.",
                "Anything that talks to it automatically — an app, a script, an integration.",
                "The email address attached to it, which can reset the password.",
            ]),
            para("Count how many of those you could not name from memory. Those are the ones to go and look at."),
        ]},
        {"id": "defensive", "title": "Key takeaways", "blocks": [
            bullets([
                "Attack surface is the total set of ways in; an attack vector is the one used.",
                "Every entry point is a promise to authenticate, validate, log and patch.",
                "The forgotten entries — staging, old keys, third-party scripts — are usually the weakest.",
                "For every new feature, ask what it exposed before asking whether it works.",
            ]),
        ]},
    ],
}

# ---------------------------------------------------------------- lesson 6
LESSONS["security-controls"] = {
    "overview": "A control is a specific thing you do that reduces a specific risk. If you cannot say which risk it reduces, it is not a control — it is a purchase.",
    "outcomes": [
        "classify a control as preventing, detecting or correcting",
        "recognise the difference between administrative, technical and physical controls",
        "check whether your controls cover all three stages or repeat one",
    ],
    "practice_guidance": "Pick one risk you already know about and write one control for each stage: prevent, detect, correct.",
    "sections": [
        {"id": "plain", "title": "In plain English", "blocks": [
            para("A control is an action, not a product. \"Turn on full-disk encryption\" is a control. \"Buy a security suite\" is a purchase, and may or may not contain one."),
            para("Controls are usually sorted two ways: by what they do, and by what kind of thing they are. Both sorts are useful, and neither is complicated."),
        ]},
        {"id": "how", "title": "How it works", "blocks": [
            para("By what they do, there are three stages, and you want at least one control at each:"),
            bullets([
                "Prevent: stop it happening. Encryption, access rules, patching, a lock.",
                "Detect: find out it happened, or is happening. Logs, alerts, a monthly permission review.",
                "Correct: recover and learn. Restore from backup, revoke a session, rotate a key, write down what went wrong.",
            ]),
            para("By what kind of thing they are, there are three types, and you want all three too:"),
            bullets([
                "Administrative: a rule or a habit — \"no shared admin accounts\".",
                "Technical: something the system enforces — permissions, MFA, rate limits.",
                "Physical: something in the world — a door code, a locked cabinet, a screen in an office.",
            ]),
            para("The two sorts cross over. A door code is a physical, preventive control. An audit log is a technical, detective control. Neither sorting is better; together they stop you from repeating the same kind of fix."),
        ]},
        {"id": "example", "title": "A worked example", "blocks": [
            para("A laptop gets stolen from a café. One risk, three stages, three controls:"),
            bullets([
                "Prevent: full-disk encryption, so the disk is useless without the login; an automatic screen lock, so the machine is not simply open.",
                "Detect: a sign-in alert for a location you have never visited; the ability to see when the device last reported in.",
                "Correct: a remote wipe, and a backup that lets you rebuild the machine without paying anything.",
            ]),
            para("Now the three types for the same risk: a policy that laptops may not be left unattended (administrative), encryption and remote wipe (technical), and keeping the bag on your body (physical). Every one of those is cheap, and together they cover the whole event rather than just the moment of theft."),
        ]},
        {"id": "mistake", "title": "The mistake most beginners make", "blocks": [
            para("Stacking the same stage. Two antivirus products, or three password policies, all doing prevention — while nothing anywhere detects a compromise or makes recovery possible. Coverage across the three stages beats depth in one."),
            para("The second mistake is a control that nobody verifies. A backup that has never been restored is a hope, not a control. The test is the control."),
        ]},
        {"id": "try", "title": "Try it in two minutes", "blocks": [
            para("Take one risk you already know about — a stolen phone is a good one — and write three lines:"),
            bullets([
                "Prevent: what stops this working?",
                "Detect: how would I find out in the first hour?",
                "Correct: how do I recover without losing more?",
            ]),
            para("If any line is blank, that is where the next hour of effort goes. It is almost never where people start."),
        ]},
        {"id": "defensive", "title": "Key takeaways", "blocks": [
            bullets([
                "A control names the risk it reduces; a purchase does not.",
                "Prevent, detect, correct — you want one of each, not three of the first.",
                "Administrative, technical and physical controls cover different failure modes.",
                "An untested control is a hope. The test is the control.",
            ]),
        ]},
    ],
}

# ---------------------------------------------------------------- lesson 7
LESSONS["security-mindset"] = {
    "overview": "Skill in security is mostly a set of habits, not a body of facts. The habits are small, boring and repeatable, and they matter more than knowing the name of the latest attack.",
    "outcomes": [
        "name the four habits that do most of the work",
        "apply them to one situation you control today",
        "spot the sentence that means a real risk is being ignored",
    ],
    "practice_guidance": "Pick one shared account or one reused password you know about, and fix just that one today. One change that sticks beats a list that does not.",
    "sections": [
        {"id": "plain", "title": "In plain English", "blocks": [
            para("People imagine security experts hold a huge catalogue of attacks in their heads. Mostly they hold four habits, and apply them over and over to whatever they are looking at."),
            para("That is good news, because habits can be learned in an afternoon and a catalogue cannot. The four below are the ones that keep coming up, in incident write-ups and in post-mortems, over and over."),
            bullets([
                "Assume something will get through, and plan for the day it does.",
                "Give each person and each program the least access it needs to do its job.",
                "Verify rather than trust — check the permission, do not assume the rule is followed.",
                "Write it down, because a plan that exists only in someone's memory leaves when they do.",
            ]),
        ]},
        {"id": "how", "title": "How it works", "blocks": [
            para("Each habit is a reaction to a specific, predictable human failure."),
            bullets([
                "Assume breach exists because \"we would notice\" is almost always false — most breaches are found by an outsider, months later.",
                "Least privilege exists because access accumulates. Nobody ever asks for less access; they only ask for more.",
                "Verify exists because rules drift. The policy says one thing, the actual permissions say another, and only a check finds out which is true.",
                "Writing it down exists because knowledge walks out of the door at the same time as the person who had it.",
            ]),
        ]},
        {"id": "example", "title": "A worked example", "blocks": [
            para("A small company keeps one \"admin\" account for the website, shared by four people, with the password on a note in a drawer. Watch each habit change one thing:"),
            bullets([
                "Assume breach: if that password leaks, you cannot tell who used it and you cannot tell when — so the fix starts with separate accounts, not with a longer password.",
                "Least privilege: the designer does not need admin rights to change a page. Removing that one permission shrinks what a stolen password is worth.",
                "Verify: check the account list quarterly. The fifth person on it will be someone who left two years ago.",
                "Write it down: one page — who has admin, how to rotate the password, who to call — so recovery does not depend on finding the one person who remembers.",
            ]),
            para("Four habits, one paragraph of work, and the whole situation changed. None of it needed a new product."),
        ]},
        {"id": "mistake", "title": "The mistake most beginners make", "blocks": [
            para("\"We are too small to be a target.\" Automated attacks do not choose targets; they scan everything and take whatever is open. Being small means you are not attacked deliberately, which is a different sentence and a much weaker comfort."),
            para("The other mistake is treating security as a project with an end date. It is closer to tidying: the work is small, it is never finished, and the cost of skipping it compounds quietly."),
        ]},
        {"id": "try", "title": "Try it in two minutes", "blocks": [
            para("Find one of these and fix only that one, today:"),
            bullets([
                "An account that more than one person can log into.",
                "A password you have used on more than one site.",
                "An old account — a job you left, a service you stopped using — that still exists.",
            ]),
            para("Then write one line in your notes about what you changed. That line is the habit starting, and it is worth more than reading another lesson."),
        ]},
        {"id": "defensive", "title": "Key takeaways", "blocks": [
            bullets([
                "Assume breach, least privilege, verify rather than trust, write it down.",
                "Access accumulates quietly; only a check finds out what is actually granted.",
                "Automated attacks do not pick targets, so \"too small\" is not a defence.",
                "One change that sticks beats a list that does not.",
            ]),
        ]},
    ],
}

# Summaries that match the rewritten lesson, not the old one.
LESSONS["what-is-cyber-security"]["description"] = 'Security is decisions about what you cannot afford to lose, not a product you install. Start with a bakery, then apply the same four words to your own accounts.'
LESSONS["cybersecurity-vs-information-security"]["description"] = 'Information security protects information; cyber security protects the machines that carry it. One employee file, in three places, shows why the difference changes the plan.'
LESSONS["cia-triad"]["description"] = 'Availability, integrity, confidentiality — three questions you can ask about any system, and the reason improving one usually costs you another.'
LESSONS["assets-threats-vulnerabilities-and-risk"]["description"] = 'Asset, threat, vulnerability, risk: four words in the right slots turn a vague worry into a specific fix you can make today.'
LESSONS["attack-surface-and-attack-vectors"]["description"] = 'The attack surface is every way in; an attack vector is the one that got used. Count the entries you forgot before you harden the one you remember.'
LESSONS["security-controls"]["description"] = 'A control names the risk it reduces. Prevent, detect, correct — you want one of each, not three of the first.'
LESSONS["security-mindset"]["description"] = 'Four habits do most of the work: assume breach, least privilege, verify rather than trust, and write it down. One afternoon of practice beats a catalogue of attacks.'

def words(s):
    return len(re.findall(r"\S+", s))

def total_words(sections):
    n = 0
    for sec in sections:
        for b in sec["blocks"]:
            n += words(" ".join(b["items"]) if b["type"] == "list" else b["text"])
    return n

def main():
    data = json.loads(CAT.read_text())
    by_slug = {t["slug"]: t for t in data["topics"]}
    missing = [s for s in LESSONS if s not in by_slug]
    if missing:
        sys.exit(f"unknown lesson slugs: {missing}")

    for slug, lesson in LESSONS.items():
        t = by_slug[slug]
        content = t["content"]
        new = dict(content)
        t["description"] = lesson["description"]
        new["overview"] = lesson["overview"]
        new["outcomes"] = lesson["outcomes"]
        new["practice_guidance"] = lesson["practice_guidance"]
        # Authored sections replace the five bullet lists. The old lists are
        # kept nowhere: they were the thing being replaced.
        new["sections"] = lesson["sections"]
        for legacy in ("how_it_works", "history", "real_world", "what_to_look_for", "defensive"):
            new.pop(legacy, None)
        t["content"] = new

    # Reading time is derived from the words on the page, everywhere in the
    # catalogue, so a stored estimate can never drift away from the lesson.
    for t in data["topics"]:
        w = words(str(t["content"].get("overview", ""))) + total_words(t["content"].get("sections", [])) \
            + sum(words(" ".join(map(str, t["content"].get(k, [])))) for k in
                  ("how_it_works", "history", "real_world", "what_to_look_for", "defensive")
                  if isinstance(t["content"].get(k), list))
        t["estimated_minutes"] = max(2, round(w / 180))

    CAT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

    for slug in LESSONS:
        t = by_slug[slug]
        w = words(t["content"]["overview"]) + total_words(t["content"]["sections"])
        print(f"  {slug[:44]:46} {w:4d} words  {t['estimated_minutes']} min  {len(t['content']['sections'])} sections")
    total = sum(len(v["sections"]) for v in LESSONS.values())
    print(f"\nrewritten: {len(LESSONS)} lessons, {total} sections")

if __name__ == "__main__":
    main()
