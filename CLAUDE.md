# 🚀 2026 Agentic Workspace Rules

## 🛠 Tech Stack & Tooling
- **Linter/Formatter:** Biome (Always run `biome check --write <file>` on save)
- **Test Runner:** Playwright v1.58.2 (Use `--no-sandbox` for root execution)
- **Package Manager:** Bun Baseline (Use `bun` for installs, `bunx` for binaries)
- **Docs Provider:** Context7 (Mandatory for all 2024+ library/API queries)

## 🤖 Agent Instructions (Strict)
1. **Context First:** ALWAYS trigger `context7` with the phrase "use context7" before writing code for external libraries.
2. **Health Check:** On session start, run `~/.claude/skills/health-check.sh` to verify MCP and VNC status.
3. **Visual Debugging:** If a UI task fails, use **Playwright MCP** to take a screenshot and analyze the state in the VNC window (Port 6080).
<!-- 4. **Final Polish:** B/byefore completing any task, run `bunx @biomejs/biome check --write .` to ensure zero linting/formatting errors. -->
<!-- 
## 🧪 Testing & Debugging Workflow
- **Headless (Default):** `npx playwright test --no-sandbox`
- **Headed (Debug):** `npx playwright test --headed --no-sandbox --timeout=0`
- **Persistence on Failure:** DO NOT close the browser if a test fails. Use `page.pause()` or keep the session active for manual inspection in VNC.
- **Self-Healing:** If a selector fails, use Playwright MCP to find the new element and update the test file automatically.
- **Notifications:** Upon any test suite failure, immediately run: `~/.claude/notify.sh "🚨 Test Failed in ${PWD##*/}"`. -->
<!-- 
## 📦 Core Commands
- **Install:** `bun install`
- **Build:** `bun run build`
- **Lint/Format:** `bunx @biomejs/biome check --write .`
- **Test:** `npx playwright test --no-sandbox`
- **Debug Test:** `npx playwright test --headed --no-sandbox` -->