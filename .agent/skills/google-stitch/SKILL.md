---
name: google-stitch
description: Skill for integrating Google Stitch AI UI/UX designs into the dashboard.
---

# Google Stitch AI Skill

This skill enables the AI agent to bridge high-fidelity UI/UX designs from Google Stitch into the local project codebase. It is primarily used for generating and updating components in the **React SPA** and **LVGL** dashboard.

## Key Capabilities
- **Design Import**: Pulling design specifications from Google Stitch projects via MCP/CLI.
- **Component Generation**: Converting Stitch design tokens and structures into React (TSX/JSX) or LVGL (C++) code.
- **Design Consistency**: Ensuring that all UI updates adhere to the brand guidelines defined in the Stitch design system.

## Usage Instructions

### 1. Connect to Stitch
To use this skill, the agent must have access to the Stitch MCP server or CLI.
- **CLI Command**: `npx @davideast/stitch-mcp` (or similar depending on environment).
- **Environment**: Requires active internet connection and valid Google Stitch project credentials.

### 2. Import a Design
When a user provides a Stitch project link or ID:
1. Run the Stitch bridge tool.
2. Inspect the exported design specifications (JSON/CSS).
3. Map the design tokens (colors, spacing, typography) to the local project's design system (e.g., `ui_helpers.h` for LVGL or `theme.ts` for React).

### 3. Generate Code
- **React**: Use the Stitch output to create functional components in `external_components/react_spa/src/components`.
- **LVGL**: Convert the design into a custom header file (e.g., `custom/tab_new_feature.h`) using the established high-performance block-flush patterns.

## Best Practices
- **Stay Performant**: When converting designs to LVGL, always prioritize the hardware-accelerated "Block Flush" technique.
- **Maintain Theme**: Use the Cyan/Dark dashboard theme as the primary color base unless the design specifically overrides it.
- **Modular Components**: Keep generated code focused on reusable components rather than monolithic page files.
