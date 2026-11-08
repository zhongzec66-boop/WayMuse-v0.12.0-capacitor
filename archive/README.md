# Archive

This directory is intentionally excluded from TypeScript, ESLint, Prettier, and Vite.

It keeps the retired Personal Shell implementation and the pre-token CSS for reference only:

- `shell/PersonalShell.tsx` — retired `?shell=1` desktop two-column shell.
- `shell/shell.css` — styles for the retired shell.
- `shell/StoredModels.ts` — `TaskStatus` / `StoredTask` / `StoredMemory` types that were only used by the shell.
- `css-legacy/` — the six CSS files replaced by `src/styles/*.css` in 0.10.0.
- `css-legacy/tint.ts` — the retired avatar-to-global-color tint sampler.
- `docs/PERSONAL-SHELL.md` — retired shell documentation.
- `docs/PHONE-THEME-0.9.md` — retired white/avatar-tint theme notes.

The shell-only storage helpers were removed from `src/storage.ts`:

- `getStoredTasks` / `setStoredTasks`
- `getMemoryEntries` / `setMemoryEntries`
- `getShellMessages` / `setShellMessages`

The storage keys are not deleted:

- tasks stay in `waymuse-demo-tasks` (the classic `{text, done}` reader still works).
- shell memories in `waymuse-demo-memory-entries` are migrated to `waymuse-demo-memories` by `readMemories`.
- shell chats in `waymuse-demo-shell-messages` remain on disk but are no longer rendered or exported.

Do not import anything from this directory.
