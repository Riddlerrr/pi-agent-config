---
description: Review a GitHub PR using gh CLI for bugs, security, performance, and refactoring
argument-hint: "[PR-number-or-URL]"
discussion: true
---
Review the GitHub PR $1. If no argument is provided, use the current branch's PR.

First, gather the PR information using the `gh` CLI. Run these commands and read their output:

```bash
# PR details (title, body, author, state, base/head branches)
gh pr view $1 --json number,title,body,author,state,baseRefName,headRefName,url,createdAt,updatedAt,comments,reviewRequests

# PR diff
gh pr diff $1

# PR review comments (if any)
gh api repos/{owner}/{repo}/pulls/{number}/comments --jq '.[] | {user: .user.login, body: .body, path: .path, line: .line, commit_id: .commit_id}'
```

If the PR number/URL is not provided, determine it from the current branch:
```bash
gh pr view --json number,url
```

Provide a structured review with the following sections:

## Summary
Brief overview of what the PR does, its scope, and estimated risk level (Low/Medium/High).

## Issues Found

### 🐛 Bugs & Logic Errors
List any bugs, logic errors, incorrect assumptions, edge cases not handled, or potential regressions. Include file/line references.

### 🔒 Security Issues
Identify security vulnerabilities: injection risks, unsafe eval, missing auth checks, secrets exposure, unsafe deserialization, path traversal, XSS/SQLi risks, insecure dependencies, etc.

### ⚡ Performance Problems
Highlight inefficient algorithms, N+1 queries, unnecessary re-renders, memory leaks, blocking operations, large bundle impacts, missing caching, or resource exhaustion risks.

### 📋 Code Quality & Maintainability
Note code smells, duplicated logic, overly complex functions, missing tests, poor naming, lack of documentation, or violation of project conventions.

## Refactoring Suggestions
Propose concrete refactoring improvements with before/after style examples where helpful:
- Extract functions/components for reusability
- Simplify complex conditionals
- Improve error handling
- Add type safety or validations
- Improve naming and structure

## Action Items
Prioritized checklist of what should be addressed before merge (must-fix vs. should-fix vs. nice-to-have).

Be specific, cite filenames and line numbers, and explain the "why" behind each finding. Avoid nitpicks unless they meaningfully impact readability or maintainability.
