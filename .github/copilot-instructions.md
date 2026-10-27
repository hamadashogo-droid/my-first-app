# Copilot instructions

## Project overview

This is a dependency-free browser game. `index.html` provides the Japanese-language page and canvas, loads `style.css`, and loads `script.js` with `defer`. The canvas is the game surface; there is no framework, bundler, or server-side code.

The game logic and rendering live together in `script.js`. The `requestAnimationFrame` loop calls `update` and `draw`; gameplay state (player, input, camera, score, lives, and game state) is held in module-level variables. World objects use world coordinates, while `cameraX` is applied during drawing to create horizontal scrolling. Platform, coin, and enemy layouts are defined near the top of the file; `resetGame` recreates mutable run state from those definitions.

## Commands

- There are no configured build, lint, or test commands, package manifest, or test runner.
- Check JavaScript syntax: `node --check script.js`
- Check patch whitespace: `git diff --check`
- To test gameplay, open `index.html` in a browser and use the keyboard or on-screen touch controls.
- There is no single-test command because the repository has no test suite.

## Repository conventions

- Keep the game dependency-free and compatible with the existing plain HTML/CSS/JavaScript setup; load page assets directly from `index.html`.
- Keep game-world positions and collision geometry in the canvas's 960 × 540 coordinate system. CSS scales the canvas responsively; `cameraX` handles world scrolling in the render pass.
- Keep level placement in the data arrays in `script.js`. When adding mutable per-run entity state, initialize or restore it in `resetGame` so restarting resets the full run.
- Preserve both keyboard and pointer-based touch controls. Keyboard hints in `index.html` and the input handling in `script.js` should stay in sync.
- Keep player-facing page text in Japanese, matching the existing interface.
- ユーザー向けの説明文や案内は、日本語で表示してください。
