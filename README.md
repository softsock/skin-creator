# Minecraft Skin Studio

A desktop-first, open-source Minecraft Java skin editor with pixel-accurate 3D painting and a
studio-quality realtime renderer. The same editor runs in a browser (Vite) and in an Electron shell.

```bash
pnpm install
pnpm dev            # web editor at http://localhost:5173
pnpm desktop        # Electron window with hot reload
pnpm check          # typecheck, lint, format check, unit tests
pnpm test:e2e       # Playwright tests against the production build
```

Press **F9** to switch between Edit and Studio mode.

- [PROJECT.md](PROJECT.md) – vision, scope, workflows, limitations
- [AGENTS.md](AGENTS.md) – rules and commands for contributors and coding agents
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – how the modules fit together
- [docs/DECISIONS.md](docs/DECISIONS.md) – why things are built the way they are
- [docs/RESEARCH.md](docs/RESEARCH.md) – study of existing editors and libraries
- [docs/ROADMAP.md](docs/ROADMAP.md) – what comes next

Not affiliated with Mojang or Microsoft. Licensed under [MIT](LICENSE).
