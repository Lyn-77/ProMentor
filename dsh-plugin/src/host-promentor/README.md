# @deepseek-ai/dsh-host-promentor

Host half of the ProMentor course dashboard: registers the `/promentor/data`
webserver route that serves a workspace's `.promentor/` tree (course.json,
progress.json, chapters/*, submissions/*) to the browser dashboard. Reads are
confined to the requested workspace's `.promentor/` directory.
