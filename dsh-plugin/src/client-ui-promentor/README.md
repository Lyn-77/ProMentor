# @deepseek-ai/dsh-client-ui-promentor

ProMentor course dashboard inside the Web GUI. Registers two slot entries:

- `conversation.input.dock` — a **ProMentor** trigger button that opens the
  dashboard for the current session's workspace (session cwd).
- `shell.overlay` — the full-frame dashboard panel: course overview
  (progress, stats, chapter table) and per-chapter lecture/source reading,
  all rendered from `.promentor/` data served by
  `@deepseek-ai/dsh-host-promentor`.

The dock trigger and the panel share one in-bundle store, so opening from any
session shows that session's project without a host round trip for the
workspace path.
