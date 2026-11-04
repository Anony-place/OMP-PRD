#!/usr/bin/env python3
"""Remove the generated self-checks and write real ones for the rewritten lessons.

assets/data/academy-self-checks.json held two very different things:

  * twelve genuine self-checks, hand-written for the Web Security Foundations
    course, keyed by topic id;
  * one hundred and six quiz-shaped objects under `by_slug`, generated from the
    lesson title and description, where the "correct" answer was the description
    pasted in and the wrong answers were sentences like "Eliminating all
    encryption and authentication logs to improve network throughput".

The second group tested nothing except whether a reader could spot the option
that mentioned the lesson title. It is the same failure as a tool that prints a
made-up result: it looks like work and is not.

Generated quizzes are deleted. The seven lessons rewritten this round get four
real questions each, about what is actually on the page.
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHECKS = ROOT / "assets/data" / "academy-self-checks.json"

def q(question, options, answer, explanation):
    return {"question": question, "options": options, "answer": answer, "explanation": explanation}

REAL = {}

REAL["what-is-cyber-security"] = [
    q("Which of these is a vulnerability rather than a threat?",
      ["A supplier whose account was breached last month",
       "One shared password used by all four staff",
       "A thief",
       "A power cut"],
      1,
      "A threat is whatever could cause the loss; a vulnerability is the gap that lets it succeed. You cannot remove a thief, but you can stop sharing one password."),
    q("You have just installed a control. What is the last step of the loop?",
      ["Buy a second control in case the first fails",
       "Write a policy about the control",
       "Check that the control still works",
       "Tell the team it is done"],
      2,
      "Verification is the step everyone skips and the only one that catches a control that quietly stopped working."),
    q("When does an ordinary software bug become a security issue?",
      ["When it is reported publicly",
       "When it crashes the application",
       "When it crosses a boundary someone was supposed to control",
       "When it is hard to fix"],
      2,
      "Lots of bugs are just bugs. They become security-relevant when they let somebody past a boundary — reading data they should not, or acting as somebody else."),
    q("Which is the better first question to ask about a system you are protecting?",
      ["Which antivirus should we buy?",
       "What would we hate to lose, and would we notice it going?",
       "How many people work here?",
       "What did the last security product advertise?"],
      1,
      "Start from the asset and from how you would find out it was gone. Tools come last, and usually turn out to be cheaper than expected."),
]

REAL["cybersecurity-vs-information-security"] = [
    q("A printed salary sheet is left on the office printer. Which is true?",
      ["Cyber security problem only",
       "Information security problem, with no cyber element",
       "Neither — it is an HR problem",
       "Both, because printers are computers"],
      1,
      "Nothing digital leaked and no system was touched. Information security covers information wherever it lives, including paper."),
    q("Which statement is correct?",
      ["The two terms mean exactly the same thing",
       "Every cyber security problem is also an information security problem, but not the reverse",
       "Every information security problem is also a cyber problem",
       "Cyber security is a subset of nothing"],
      1,
      "Computers hold information, so a cyber problem is always an information problem. Information on paper or in a conversation has no cyber element at all."),
    q("The same employee file sits on a shared drive readable by everyone in the company. Which applies?",
      ["Information security only",
       "Cyber security only",
       "Both: the rule about who may read it, and the permissions that enforce it",
       "Neither, if the file is not secret"],
      2,
      "The policy is information security; the permissions that actually enforce it are cyber security. That is why the two are usually handled together."),
    q("What do most real incidents start with?",
      ["A nation-state actor with a zero-day",
       "Information crossing a boundary nobody was watching",
       "A physical break-in",
       "A hardware failure"],
      1,
      "Boring boundary failures — an attachment to a personal address, a link shared too widely — explain far more incidents than clever attacks do."),
]

REAL["cia-triad"] = [
    q("A transfer posts twice and your balance shows the wrong number. Which goal failed?",
      ["Availability", "Integrity", "Confidentiality", "None — it is a display bug"],
      1,
      "Everything is reachable and nothing leaked; the value itself is wrong. That is integrity."),
    q("Which goal's failures usually go unnoticed the longest?",
      ["Availability", "Integrity", "Confidentiality", "They are all noticed equally"],
      2,
      "An outage is obvious and a wrong balance is visible. Somebody else reading your data looks exactly like nothing happening, which is why it can run for months."),
    q("Keeping more backups improves availability but makes which goal harder?",
      ["Integrity", "Confidentiality", "None — backups only help", "Availability, again"],
      1,
      "Every extra copy is another place the data can leak from. Adding a control almost always costs something somewhere else."),
    q("What is the right way to handle the tension between the three goals?",
      ["Maximise all three at once",
       "Pick one goal and ignore the other two",
       "Decide deliberately which one you would sacrifice first, and write it down",
       "Let each team decide separately"],
      2,
      "The point is not to win the trade-off, it is to make it on purpose instead of discovering it during an incident."),
]

REAL["assets-threats-vulnerabilities-and-risk"] = [
    q("A cable lock that can be cut in nine seconds is which of the four?",
      ["Asset", "Threat", "Vulnerability", "Risk"],
      2,
      "It is the specific gap that lets the loss happen. The thief is the threat; the bicycle is the asset."),
    q("Which one is a threat and not a vulnerability?",
      ["A shared password used by four staff",
       "A server that has not been patched since last year",
       "A thief",
       "An open cloud storage bucket"],
      2,
      "You cannot remove a thief from the world. You can close the gaps that make theft easy, which is why the other three are the ones you fix."),
    q("Bots replay leaked passwords against a login page with no rate limit. What do you fix?",
      ["The bots",
       "The vulnerability: add a rate limit and require a second factor",
       "Nothing — the passwords were leaked elsewhere",
       "The risk, by renaming the login page"],
      1,
      "You cannot stop bots existing. You can make a leaked password insufficient, which turns a cheap automated attack into an expensive manual one."),
    q("Risk is best described as which of these?",
      ["A yes-or-no question",
       "How likely the loss is, combined with how much it would hurt",
       "The number of vulnerabilities found",
       "Whatever the scanner reports"],
      1,
      "Every system carries some risk. The useful question is whether it is understood and priced, not whether it exists."),
]

REAL["attack-surface-and-attack-vectors"] = [
    q("Which sentence is correct?",
      ["The attack surface is the one route that was used; the vector is the total set",
       "The attack surface is the total set of ways in; a vector is the one that was used",
       "They are two words for the same thing",
       "The surface only counts things you built recently"],
      1,
      "You count and reduce the surface. You read about a vector afterwards, in the incident report."),
    q("Which entry point is most often forgotten?",
      ["The public login page",
       "The admin panel",
       "A staging copy from last year, still online, with the default password",
       "The mobile app's API"],
      2,
      "The forgotten entries are usually weaker than the ones you are carefully testing, because nobody has looked at them since the day they were set up."),
    q("You ship a new feature. What should you ask before asking whether it works?",
      ["What did we just expose?",
       "How many users will use it?",
       "Does it look good on mobile?",
       "Who signed off on it?"],
      0,
      "Every entry point is a promise to authenticate, validate, log and patch. Best to know what you promised before you find out the hard way."),
    q("Every entry point you add is a promise to do which four things?",
      ["Design, build, test and ship",
       "Authenticate, validate, log and patch",
       "Document, announce, train and review",
       "Encrypt, hash, salt and rotate"],
      1,
      "Those four are the ongoing cost of exposing something. A form you never patch is a form that gets used against you."),
]

REAL["security-controls"] = [
    q("A backup that has never been restored is best described as…",
      ["A complete control",
       "A hope, not a control",
       "Unnecessary if the disk is new",
       "A detective control"],
      1,
      "The test is the control. Until you have restored from it, you do not know that it works — you know that it ran."),
    q("A company has three prevention products and nothing that detects or recovers. What is wrong?",
      ["Nothing, three layers is better",
       "They spent too little",
       "They covered one stage three times and left the other two empty",
       "They need a fourth prevention product"],
      2,
      "When prevention fails — and it eventually does — nothing tells you, and nothing helps you recover. Coverage across stages beats depth in one."),
    q("A door code on the server room is which kind of control?",
      ["Technical and detective",
       "Physical and preventive",
       "Administrative and corrective",
       "Physical and corrective"],
      1,
      "It is a thing in the world (physical), and it stops the event rather than reporting it (preventive)."),
    q("Which set covers all three stages for a stolen laptop?",
      ["Two antivirus products and a firewall",
       "A policy that laptops must not be left unattended",
       "A longer login password",
       "Full-disk encryption; a sign-in alert; remote wipe and a tested backup"],
      3,
      "Prevent, detect, correct — one control at each stage. The policy from the third option is useful too, but it covers one stage only."),
]

REAL["security-mindset"] = [
    q("Why does least privilege exist?",
      ["Because auditors ask for it",
       "Because access only ever accumulates: nobody asks for less",
       "Because it makes systems faster",
       "Because it removes the need for passwords"],
      1,
      "People ask for access to do a job and never ask to have it removed afterwards. That is why the permissions you have today are never the permissions you granted."),
    q("Four people share one admin account with the password on a note. What is the first fix?",
      ["Make the password longer",
       "Move the note somewhere hidden",
       "Give each person their own account",
       "Change the password every month"],
      2,
      "Until each person has their own account you cannot tell who did what, or revoke one person without locking out the rest. Everything else can wait."),
    q("Automated attacks scan everything and take whatever is open. What follows?",
      ["A small organisation is not a target, so it can wait",
       "Being small means you are not attacked deliberately — which is not the same as being safe",
       "Only banks need to worry",
       "Automated attacks are easy to spot"],
      1,
      "You are probably not chosen. You may still be swept up, because scanning costs the attacker almost nothing."),
    q("A policy says only two people have admin access. Which habit makes sure that is true?",
      ["Assume breach",
       "Least privilege",
       "Verify rather than trust",
       "Write it down"],
      2,
      "Rules drift away from reality. Only checking the actual permissions tells you what is really granted, as opposed to what was decided once."),
]

def main():
    data = json.loads(CHECKS.read_text())
    before = len(data.get("by_slug", {}))
    before_ids = len([k for k in data if k != "by_slug"])

    # Everything under by_slug was generated. Keep only the hand-written ones
    # (keyed by topic id) and the real checks written here.
    data.pop("by_slug", None)
    data["by_slug"] = {slug: {"questions": questions} for slug, questions in REAL.items()}

    CHECKS.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"removed {before} generated self-checks, kept {before_ids} hand-written")
    print(f"added {len(REAL)} real self-checks ({sum(len(v) for v in REAL.values())} questions)")

if __name__ == "__main__":
    main()
