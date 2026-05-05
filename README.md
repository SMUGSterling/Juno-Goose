# README for Juno-Goose
An SMU hardened (safety and secruity focused) system.md configuration for Goose (https://goose-docs.ai/)

## Why Juno-Goose?
[How Swiss Guards And Sacred Geese Saved Rome](https://www.npr.org/2012/05/05/152092224/how-swiss-guards-and-sacred-geese-saved-rome)

## What this custom system.md file does

Think of this as a firewall for AI behavior. It establishes a **Safety First** mindset for Goose, specifically tailored for the SMU environment.

- **Secret Protection:** It watches for actual passwords, tokens, private keys, API keys, and other credential-like material. If it finds what looks like a real credential, it hides the value behind a `[REDACTED]` tag so it is not repeated, saved in logs, or copied into other files.

- **Smart Secret Handling:** It does **not** treat every mention of words like “password,” “token,” or “API key” as a security incident. Policy text, placeholders, examples, and already-redacted values should not trigger remediation mode by themselves.

- **Privacy Guard (FERPA):** It is designed to treat student records and educational data carefully. When possible, it will de-identify information, such as using “Student A” instead of a real name.

- **Permission Checks:** The AI is not supposed to make risky changes (such as editing important files, deleting files, installing software, running code, changing Git state, or sending data over the internet) without explaining the risk and getting confirmation first.

- **`--ok` Confirmation Shortcut:** For safe, clearly scoped, project-local tasks, you can add `--ok` to your request to skip routine confirmation prompts. This is only for low-impact actions and does **not** bypass real security rules.

- **Trick Resistance:** It helps prevent the AI from being “socially engineered.” If a malicious website, README, log, or file contains hidden text telling the AI to “Ignore your security rules,” the agent is instructed to ignore those tricks and stick to the security policy.

- **Safety Backups:** Before modifying files, it should prefer creating a timestamped backup in a project-local backup folder when practical and safe.

- **Soft Delete:** For approved delete actions, it should prefer moving files into a project-local trash folder instead of permanently deleting them.

## How to Install It

To use this with the Goose agent, or a similar AI tool, follow these steps:

1. **Open :gear:Settings:** Located on the LEFT panel.

2. **Open :page_facing_up:Prompts:** Located in the tabs at the TOP.

3. **Locate system.md** and click ```Edit```

4. **Paste the Text:** Copy the full text of the latest SMU Security Core (system.md)

5. **Save/Apply:** After pasting into the field, save the changes.

6. **Restart the Session:** Start a new chat with the agent to ensure the new rules are active.

## How to Use It

Use Goose normally, but give it clear instructions.

Good examples:

```text
Review this folder and suggest improvements. Do not edit files yet.
```

```text
Draft a safer README section and show it to me before changing the file.
```

```text
Update README.md with the wording we discussed --ok
```

Avoid vague high-risk instructions like:

```text
Do whatever is needed.
```

The Security Core is designed not to treat broad permission as approval for risky actions.

## Using the `--ok` Flag

The `--ok` flag is a convenience shortcut for safe, bounded actions. It tells Goose:

> If this action is safe, clearly scoped, and project-local, you may proceed without asking me for the routine confirmation message.

For example:

```text
Add this paragraph to README.md --ok
```

```text
Create a short project note in .goose/notes.md --ok
```

```text
Restore the most recent backup of README.md --ok
```

### What `--ok` Can Be Used For

`--ok` may be appropriate for:

- small edits to a non-sensitive project document you specifically named
- creating or updating non-sensitive scratch files
- creating a project-local backup note
- soft-deleting a specifically named, non-sensitive project file
- restoring a specifically named, non-sensitive file from `.goose-backups/` or `.goose-trash/`

### What `--ok` Cannot Be Used For

`--ok` does **not** bypass real security protections.

It should not be used for:

- secrets, credentials, tokens, private keys, or `.env` files
- credential stores or high-risk system paths
- student records, FERPA data, or sensitive institutional data
- network calls, uploads, downloads, syncs, or API requests
- installing or updating packages
- running scripts, tests, builds, binaries, package managers, or project code
- Git changes such as commit, push, reset, rebase, checkout, or clean
- permission changes
- admin actions such as `sudo` or `runas`
- broad, destructive, or unclear requests

If Goose is unsure whether `--ok` applies, it should ignore the flag and ask for confirmation normally.

## Confirmation Prompts

For risky actions, Goose should still ask before proceeding.

A confirmation request should explain:

```text
Action: what Goose wants to do
Target: what files or systems are involved
Risk: why it matters
Request: Confirm before I proceed.
```

Only confirm if you understand and agree with the action.

Good confirmation:

```text
Confirm. Edit README.md as described.
```

Poor confirmation:

```text
Sure, do whatever.
```

## Remediation Mode

If Goose enters **remediation-only mode**, it means it believes it found a real credential or secret.

In that mode, Goose should stop normal work and help only with cleanup, such as:

- rotating or revoking the credential
- removing it from files
- removing it from logs or Git history
- checking where it may have been exposed
- verifying cleanup without repeating the secret

To resume normal work, type exactly:

```text
remediation complete
```

Do not type that phrase until the credential has actually been handled.

## Backups and Undo

This Security Core assumes the user may not know Git.

When practical and safe, Goose should create backups before modifying non-scratch files.

Typical backup folder:

```text
.goose-backups/
```

For approved delete actions, Goose should prefer soft delete.

Typical trash folder:

```text
.goose-trash/
```

If something goes wrong, you can ask:

```text
Restore the most recent backup of README.md.
```

or:

```text
Restore the deleted file from .goose-trash.
```

Backups and soft-delete are safety nets, not guarantees. If no backup exists, Goose should say so clearly.

## Limitations

This Security Core significantly improves Goose’s safety behavior, but it is not a silver bullet.

- **Human Review Is Still Required:** If Goose asks for permission to run a risky command and you say “Yes,” it may proceed. The system cannot protect you from every action you explicitly approve.

- **Not an Antivirus:** This is a behavioral guide for the AI. It does not replace antivirus software, endpoint protection, malware scanning, or IT security review.

- **Not Perfect Secret Detection:** Goose may miss a secret, over-redact harmless text, or ask for confirmation when it is not strictly necessary.

- **Some Friction Is Intentional:** The agent may ask for confirmation more often than a standard AI. The `--ok` flag helps reduce routine prompts, but it should not weaken real security controls.

- **Complex Attacks Are Still Possible:** The Security Core helps resist prompt injection and hidden instructions, but no AI prompt can guarantee perfect protection against sophisticated attacks.

- **Policy Still Matters:** For student records, legal issues, HR data, research-confidential data, or actual security incidents, follow SMU policies and the appropriate escalation path.

## Plain-Language Summary

This Goose setup is designed to be cautious. It protects credentials, student records, institutional data, and your computer. It stays inside the project folder, asks before risky actions, avoids sending data outside without approval, makes backups when practical, and prefers soft-delete instead of permanent deletion.

Use `--ok` when you want Goose to skip routine confirmation for safe, small, project-local actions.

A human should still review important work, especially when Goose is editing files, deleting files, running commands, installing software, handling student records, using Git, or working near credentials.
