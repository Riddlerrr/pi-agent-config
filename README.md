# pi-agent-config
 Config files for My Pi agent setup

## Setup

Run the following command from the repo directory:

```bash
stow -t ~/.pi/agent .
```

If Stow reports a conflict with the machine-local `skills/omarchy-app` symlink, add `--ignore='omarchy-app$'` to that command.

## Smart router

Stow installs `extensions/smart-router/` as a Pi extension. Start Pi with `HINDSIGHT_API_DECISION_MODEL_API_KEY` supplied by your secret manager (never commit it) and `NODE_USE_SYSTEM_CA=1` to trust the installed homelab CA. The router sends up to 4,000 characters of the latest prompt to `https://decide.test/v1/systemone` over Tailscale; if unavailable, it uses local rules.

Select `openai-codex/smart` in `/model`. Preview a decision with `/route-test Add pagination`; `hs-decide-1-flash:` indicates a live decision.
