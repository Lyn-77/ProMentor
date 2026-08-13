window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-promentor",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/data.ts
		const DATA_URL = "/promentor/data";
		function dataUrl(workspace, path) {
			return `${DATA_URL}?ws=${encodeURIComponent(workspace)}&p=${encodeURIComponent(path)}`;
		}
		async function getJson(workspace, path) {
			try {
				const res = await fetch(dataUrl(workspace, path));
				if (!res.ok) return null;
				return await res.json();
			} catch {
				return null;
			}
		}
		async function getText(workspace, path) {
			try {
				const res = await fetch(dataUrl(workspace, path));
				if (!res.ok) return null;
				return await res.text();
			} catch {
				return null;
			}
		}
		async function hasFile(workspace, path) {
			try {
				return (await fetch(dataUrl(workspace, path), { method: "HEAD" })).ok;
			} catch {
				return false;
			}
		}
		/**
		* Whether the workspace holds a course — the same predicate `loadCourse`
		* uses for `found` (course.json or progress.json present). Used by the dock
		* trigger to only surface the button for initialized workspaces.
		*/
		async function hasCourse(workspace) {
			const [course, progress] = await Promise.all([hasFile(workspace, "course.json"), hasFile(workspace, "progress.json")]);
			return course || progress;
		}
		const REQUIRED_FILES = {
			lecture: "lecture.md",
			source: "source.md",
			lab: "lab.json"
		};
		function fallbackTitle(slug) {
			return slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
		}
		function parseChapter(meta, progress) {
			const prog = progress.chapters?.[meta.id] ?? { status: "not_started" };
			const match = meta.id.match(/^(ch\d+)-(.*)$/);
			const num = match?.[1] ?? meta.id;
			const slug = match?.[2] ?? meta.id;
			return {
				...meta,
				num,
				slug,
				title: meta.title || fallbackTitle(slug),
				difficulty: meta.difficulty || "-",
				progress: prog,
				files: {
					lecture: false,
					source: false,
					lab: false
				}
			};
		}
		async function loadCourse(workspace) {
			const [courseJson, progressJson] = await Promise.all([getJson(workspace, "course.json"), getJson(workspace, "progress.json")]);
			const course = courseJson ?? {};
			const progress = progressJson ?? {};
			const metas = course.chapters ?? [];
			const chapters = await Promise.all(metas.map(async (meta) => {
				const chapter = parseChapter(meta, progress);
				const [lecture, source, lab] = await Promise.all([
					hasFile(workspace, `chapters/${chapter.id}/${REQUIRED_FILES.lecture}`),
					hasFile(workspace, `chapters/${chapter.id}/${REQUIRED_FILES.source}`),
					hasFile(workspace, `chapters/${chapter.id}/${REQUIRED_FILES.lab}`)
				]);
				chapter.files = {
					lecture,
					source,
					lab
				};
				return chapter;
			}));
			const currentId = progress.current_chapter ?? null;
			const current = chapters.find((ch) => ch.id === currentId) ?? chapters.find((ch) => ch.progress.status === "in_progress") ?? null;
			const completed = chapters.filter((ch) => ch.progress.status === "completed").length;
			const inProgress = chapters.filter((ch) => ch.progress.status === "in_progress").length;
			const notStarted = chapters.filter((ch) => ch.progress.status === "not_started").length;
			const total = chapters.length;
			const percent = total ? completed / total * 100 : 0;
			const missing = chapters.flatMap((ch) => Object.keys(REQUIRED_FILES).filter((name) => !ch.files[name]).map((name) => `${ch.id} 缺 ${name}`));
			return {
				name: course.project || progress.project_name || "ProMentor Course",
				language: course.language || "-",
				found: Boolean(courseJson || progressJson),
				chapters,
				current,
				completed,
				inProgress,
				notStarted,
				total,
				percent,
				missing
			};
		}
		async function loadChapterContent(workspace, id) {
			const [lecture, source] = await Promise.all([getText(workspace, `chapters/${id}/lecture.md`), getText(workspace, `chapters/${id}/source.md`)]);
			return {
				lecture,
				source
			};
		}
		//#endregion
		//#region \0dsh-css:/Users/lijianlin/CODE/project/deepseek-harness/packages/client/ui-promentor/src/client/dock.module.css.mjs
		const css$1 = ".aPQCKa_card,.aPQCKa_cardActive{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-tip);text-align:left;width:fit-content;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:12px;flex:none;align-items:center;gap:10px;margin:0 auto;padding:6px 12px;font-family:inherit;font-size:13px;line-height:20px;display:flex}.aPQCKa_card:hover{border-color:var(--dsw-alias-border-l2)}.aPQCKa_cardActive{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-button-primary-dimmed)}.aPQCKa_lead{color:var(--dsw-alias-label-secondary);flex:none;display:inline-flex}.aPQCKa_cardActive .aPQCKa_lead{color:var(--dsw-alias-brand-primary)}.aPQCKa_label{flex:none;font-weight:500}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-promentor/dock.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-promentor";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var dock_module_css_default = {
			"lead": "aPQCKa_lead",
			"card": "aPQCKa_card",
			"cardActive": "aPQCKa_cardActive",
			"label": "aPQCKa_label"
		};
		//#endregion
		//#region src/client/dock.tsx
		/**
		* Composer-dock trigger: opens the ProMentor dashboard panel for the current
		* session's workspace (the dock slot is session-scoped, so the inject face
		* receives the session id and the button resolves its cwd at click time).
		*/
		/** How often the trigger re-probes the workspace for a `.promentor/` course. */
		const PROBE_INTERVAL_MS = 1e4;
		function DashboardTrigger({ getSnapshot, subscribe, open, close, getWorkspace, t }) {
			const state = (0, react.useSyncExternalStore)(subscribe, getSnapshot);
			const workspace = getWorkspace();
			const [available, setAvailable] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (workspace === null) {
					setAvailable(false);
					return;
				}
				let cancelled = false;
				const probe = () => {
					hasCourse(workspace).then((ok) => {
						if (!cancelled) setAvailable(ok);
					});
				};
				probe();
				const timer = setInterval(probe, PROBE_INTERVAL_MS);
				return () => {
					cancelled = true;
					clearInterval(timer);
				};
			}, [workspace]);
			if (available !== true) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				title: state.open ? t("dockClose") : t("dockOpen"),
				className: state.open ? dock_module_css_default.cardActive : dock_module_css_default.card,
				onClick: () => {
					if (state.open) close();
					else open();
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: dock_module_css_default.lead,
					"aria-hidden": true,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconListPenOutline16, {})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: dock_module_css_default.label,
					children: t("dockLabel")
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/lijianlin/CODE/project/deepseek-harness/packages/client/ui-promentor/src/client/panel.module.css.mjs
		const css = ".PWXNIq_overlay{--pm-bg:#fff;--pm-fg:#09090b;--pm-muted:#f4f4f5;--pm-muted-fg:#71717a;--pm-border:#e4e4e7;--pm-primary:#09090b;--pm-success:#059669;--pm-success-bg:#d1fae5;--pm-success-fg:#065f46;--pm-warning:#d97706;--pm-warning-bg:#fef3c7;--pm-warning-fg:#92400e;--pm-danger:#dc2626;--pm-danger-bg:#fee2e2;--pm-danger-fg:#991b1b;--pm-danger-border:#dc262666;z-index:1;background:var(--dsw-alias-bg-mask-2);pointer-events:auto;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}body[data-ds-dark-theme] .PWXNIq_overlay{--pm-bg:#09090b;--pm-fg:#fafafa;--pm-muted:#27272a;--pm-muted-fg:#a1a1aa;--pm-border:#27272a;--pm-primary:#fafafa;--pm-success:#34d399;--pm-success-bg:#064e3b66;--pm-success-fg:#a7f3d0;--pm-warning:#fbbf24;--pm-warning-bg:#78350f66;--pm-warning-fg:#fde68a;--pm-danger:#f87171;--pm-danger-bg:#7f1d1d66;--pm-danger-fg:#fecaca;--pm-danger-border:#f8717166}.PWXNIq_panel{background:var(--pm-bg);width:min(980px,100vw - 48px);height:min(760px,100vh - 48px);color:var(--pm-fg);border-radius:12px;flex-direction:column;display:flex;overflow:hidden;box-shadow:0 24px 80px #00000059}.PWXNIq_header{border-bottom:1px solid var(--pm-border);align-items:center;gap:12px;padding:10px 16px;display:flex}.PWXNIq_title{white-space:nowrap;flex:none;font-size:15px;font-weight:600}.PWXNIq_headerActions{gap:4px;margin-left:auto;display:flex}.PWXNIq_body{flex:1;padding:24px 28px;overflow:auto}.PWXNIq_note{text-align:center;color:var(--pm-muted-fg);padding:32px 16px;font-size:14px}.PWXNIq_note p{margin:8px 0 0}.PWXNIq_overview{flex-direction:column;gap:20px;width:100%;max-width:880px;margin:0 auto;display:flex}.PWXNIq_overviewHeader{align-items:baseline;gap:10px;display:flex}.PWXNIq_courseName{margin:0;font-size:24px;font-weight:500;line-height:1.3}.PWXNIq_language{color:var(--pm-muted-fg);font-size:14px}.PWXNIq_card{border:1px solid var(--pm-border);background:var(--pm-bg);border-radius:8px;padding:14px 16px}.PWXNIq_progressRow{justify-content:space-between;align-items:baseline;font-size:14px;display:flex}.PWXNIq_percent{font-weight:600}.PWXNIq_progressBar{background:var(--pm-muted);border-radius:999px;height:8px;margin-top:8px;overflow:hidden}.PWXNIq_progressFill{background:var(--pm-primary);border-radius:999px;height:100%}.PWXNIq_hint{color:var(--pm-muted-fg);margin:8px 0 0;font-size:12px}.PWXNIq_stats{grid-template-columns:repeat(3,1fr);gap:12px;display:grid}.PWXNIq_statValue{margin:0;font-size:24px;font-weight:500}.PWXNIq_statLabel{color:var(--pm-muted-fg);margin:2px 0 0;font-size:12px}.PWXNIq_toneOk{color:var(--pm-success)}.PWXNIq_toneWarn{color:var(--pm-warning)}.PWXNIq_toneMuted{color:var(--pm-muted-fg)}.PWXNIq_table{border-collapse:collapse;width:100%;font-size:14px}.PWXNIq_table th{text-align:center;height:36px;color:var(--pm-muted-fg);white-space:nowrap;border-bottom:1px solid var(--pm-border);padding:0 12px;font-size:14px;font-weight:500}.PWXNIq_table td{text-align:center;border-bottom:1px solid var(--pm-border);padding:12px}.PWXNIq_chapterRow{cursor:pointer}.PWXNIq_chapterRow:hover{background:color-mix(in srgb, var(--pm-muted) 50%, transparent)}.PWXNIq_chapterTitle{font-weight:500}.PWXNIq_chapterTitle:hover{text-decoration:underline}.PWXNIq_mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}.PWXNIq_dim{color:var(--pm-muted-fg)}.PWXNIq_badge{white-space:nowrap;border:1px solid #0000;border-radius:0;padding:1px 8px;font-size:12px;font-weight:500;line-height:1.5;display:inline-block}.PWXNIq_badgeOk{background:var(--pm-success-bg);color:var(--pm-success-fg)}.PWXNIq_badgeWarn{background:var(--pm-warning-bg);color:var(--pm-warning-fg)}.PWXNIq_badgeDanger{background:var(--pm-danger-bg);color:var(--pm-danger-fg)}.PWXNIq_badgeMuted{background:var(--pm-muted);color:var(--pm-muted-fg)}.PWXNIq_missing{border-color:var(--pm-danger-border)}.PWXNIq_missing h3{margin:0 0 8px;font-size:14px;font-weight:500}.PWXNIq_missing ul{color:var(--pm-muted-fg);margin:0;padding-left:18px;font-size:12px}.PWXNIq_chapter{gap:32px;width:100%;max-width:960px;margin:0 auto;display:flex}.PWXNIq_chapterAside{flex-direction:column;flex:none;gap:20px;width:184px;display:flex}.PWXNIq_backLink{color:var(--pm-muted-fg);cursor:pointer;text-align:left;background:0 0;border:none;align-items:center;gap:6px;padding:0;font-size:14px;line-height:20px;display:inline-flex}.PWXNIq_backLink:hover{color:var(--pm-fg)}.PWXNIq_chapterMeta{flex-direction:column;gap:6px;display:flex}.PWXNIq_chapterName{margin:0;font-size:14px;font-weight:500;line-height:1.45}.PWXNIq_chapterId{color:var(--pm-muted-fg);margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}.PWXNIq_tabs{flex-direction:column;gap:2px;display:flex}.PWXNIq_tab{text-align:left;width:100%;color:var(--pm-muted-fg);cursor:pointer;background:0 0;border:none;border-left:2px solid #0000;align-items:center;gap:8px;padding:7px 12px;font-size:14px;line-height:20px;display:flex}.PWXNIq_tab:hover{color:var(--pm-fg)}.PWXNIq_tabActive{border-left-color:var(--pm-primary);background:var(--pm-muted);color:var(--pm-fg);font-weight:500}.PWXNIq_tabIcon{color:var(--pm-muted-fg);display:inline-flex}.PWXNIq_tabActive .PWXNIq_tabIcon{color:var(--pm-primary)}.PWXNIq_chapterMain{flex:1;min-width:0}";
		const tagId = "@deepseek-ai/dsh-client-ui-promentor/panel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-promentor";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var panel_module_css_default = {
			"body": "PWXNIq_body",
			"chapterRow": "PWXNIq_chapterRow",
			"card": "PWXNIq_card",
			"overview": "PWXNIq_overview",
			"language": "PWXNIq_language",
			"chapterTitle": "PWXNIq_chapterTitle",
			"badgeOk": "PWXNIq_badgeOk",
			"badgeDanger": "PWXNIq_badgeDanger",
			"missing": "PWXNIq_missing",
			"chapterAside": "PWXNIq_chapterAside",
			"backLink": "PWXNIq_backLink",
			"chapterId": "PWXNIq_chapterId",
			"toneWarn": "PWXNIq_toneWarn",
			"chapterMain": "PWXNIq_chapterMain",
			"toneMuted": "PWXNIq_toneMuted",
			"progressRow": "PWXNIq_progressRow",
			"tabs": "PWXNIq_tabs",
			"overlay": "PWXNIq_overlay",
			"overviewHeader": "PWXNIq_overviewHeader",
			"panel": "PWXNIq_panel",
			"hint": "PWXNIq_hint",
			"badge": "PWXNIq_badge",
			"badgeMuted": "PWXNIq_badgeMuted",
			"statValue": "PWXNIq_statValue",
			"toneOk": "PWXNIq_toneOk",
			"tabIcon": "PWXNIq_tabIcon",
			"stats": "PWXNIq_stats",
			"progressBar": "PWXNIq_progressBar",
			"statLabel": "PWXNIq_statLabel",
			"headerActions": "PWXNIq_headerActions",
			"header": "PWXNIq_header",
			"tabActive": "PWXNIq_tabActive",
			"chapterName": "PWXNIq_chapterName",
			"progressFill": "PWXNIq_progressFill",
			"dim": "PWXNIq_dim",
			"note": "PWXNIq_note",
			"table": "PWXNIq_table",
			"mono": "PWXNIq_mono",
			"tab": "PWXNIq_tab",
			"chapterMeta": "PWXNIq_chapterMeta",
			"courseName": "PWXNIq_courseName",
			"percent": "PWXNIq_percent",
			"badgeWarn": "PWXNIq_badgeWarn",
			"title": "PWXNIq_title",
			"chapter": "PWXNIq_chapter"
		};
		//#endregion
		//#region src/client/panel.tsx
		/**
		* Full-frame ProMentor dashboard panel (shell.overlay entry): course
		* overview, per-chapter lecture/source reading, and progress at a glance.
		* The panel is rendered by the root-scoped overlay slot while the shared
		* store says it is open.
		*/
		function DashboardPanel({ getSnapshot, subscribe, close, refresh, t }) {
			const state = (0, react.useSyncExternalStore)(subscribe, getSnapshot);
			const workspace = state.workspacePath;
			const [course, setCourse] = (0, react.useState)(null);
			const [ready, setReady] = (0, react.useState)(false);
			const [chapterId, setChapterId] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (!state.open || workspace === null) return;
				let cancelled = false;
				setReady(false);
				setCourse(null);
				setChapterId(null);
				loadCourse(workspace).then((loaded) => {
					if (!cancelled) setCourse(loaded);
				}).finally(() => {
					if (!cancelled) setReady(true);
				});
				return () => {
					cancelled = true;
				};
			}, [
				state.open,
				workspace,
				state.refreshKey
			]);
			if (!state.open) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.overlay,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_default.panel,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: panel_module_css_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.title,
							children: t("title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.headerActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								variant: "ghost",
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, {}),
								onClick: refresh,
								children: t("refresh")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								variant: "ghost",
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, {}),
								onClick: close
							})]
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.body,
						children: workspace === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Note, { children: t("noWorkspace") }) : !ready ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Note, { children: t("loading") }) : !course?.found ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Note, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("noCourse") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("noCourseHint") })] }) : chapterId !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChapterView, {
							workspace,
							chapterId,
							onBack: () => setChapterId(null),
							t
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Overview, {
							course,
							onOpen: (id) => setChapterId(id),
							t
						})
					})]
				})
			});
		}
		function Note({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.note,
				children
			});
		}
		function Overview({ course, onOpen, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.overview,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.overviewHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							className: panel_module_css_default.courseName,
							children: course.name
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.language,
							children: course.language
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.card,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.progressRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("overall") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: panel_module_css_default.percent,
									children: [course.percent.toFixed(1), "%"]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.progressBar,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_default.progressFill,
									style: { width: `${course.percent}%` }
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: panel_module_css_default.hint,
								children: [
									course.completed,
									"/",
									course.total,
									" ",
									t("chaptersDone"),
									course.current && ` · ${t("currentLearning")}: ${course.current.title}`
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.stats,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
								value: course.completed,
								label: t("done"),
								tone: "ok"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
								value: course.inProgress,
								label: t("learning"),
								tone: "warn"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
								value: course.notStarted,
								label: t("notStarted"),
								tone: "muted"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.card,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
							className: panel_module_css_default.table,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("chapter") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("titleCol") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("difficulty") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("status") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("score") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("attempts") })
							] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: course.chapters.map((chapter) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
								className: panel_module_css_default.chapterRow,
								onClick: () => onOpen(chapter.id),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: panel_module_css_default.mono,
										children: chapter.num
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_default.chapterTitle,
										children: chapter.title
									}) }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DifficultyBadge, { difficulty: chapter.difficulty }) }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusBadge, {
										status: chapter.progress.status,
										t
									}) }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: panel_module_css_default.dim,
										children: chapter.progress.status === "completed" ? (chapter.progress.score ?? 0).toFixed(1) : "-"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: panel_module_css_default.dim,
										children: chapter.progress.attempts ?? 0
									})
								]
							}, chapter.id)) })]
						})
					}),
					course.missing.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: `${panel_module_css_default.card} ${panel_module_css_default.missing}`,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("missingFiles") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", { children: course.missing.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: item }, item)) })]
					})
				]
			});
		}
		function Stat({ value, label, tone }) {
			const tones = {
				ok: panel_module_css_default.toneOk,
				warn: panel_module_css_default.toneWarn,
				muted: panel_module_css_default.toneMuted
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: `${panel_module_css_default.statValue} ${tones[tone]}`,
					children: value
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: panel_module_css_default.statLabel,
					children: label
				})]
			});
		}
		function DifficultyBadge({ difficulty }) {
			const tone = difficulty === "easy" ? panel_module_css_default.badgeOk : difficulty === "hard" ? panel_module_css_default.badgeDanger : panel_module_css_default.badgeWarn;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `${panel_module_css_default.badge} ${tone}`,
				children: difficulty
			});
		}
		const STATUS_LABEL = {
			completed: "done",
			in_progress: "learning",
			not_started: "notStarted"
		};
		function StatusBadge({ status, t }) {
			const tone = status === "completed" ? panel_module_css_default.badgeOk : status === "in_progress" ? panel_module_css_default.badgeWarn : panel_module_css_default.badgeMuted;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `${panel_module_css_default.badge} ${tone}`,
				children: t(STATUS_LABEL[status])
			});
		}
		function ChapterView({ workspace, chapterId, onBack, t }) {
			const [content, setContent] = (0, react.useState)(null);
			const [chapter, setChapter] = (0, react.useState)(null);
			const [tab, setTab] = (0, react.useState)("lecture");
			(0, react.useEffect)(() => {
				let cancelled = false;
				setContent(null);
				setChapter(null);
				setTab("lecture");
				Promise.all([loadChapterContent(workspace, chapterId), loadCourse(workspace)]).then(([loaded, course]) => {
					if (cancelled) return;
					setContent(loaded);
					setChapter(course.chapters.find((ch) => ch.id === chapterId) ?? null);
				});
				return () => {
					cancelled = true;
				};
			}, [workspace, chapterId]);
			const tabs = [{
				id: "lecture",
				label: t("lecture"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconListPenOutline16, {})
			}, {
				id: "source",
				label: t("source"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutline16, {})
			}];
			const body = content?.[tab];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.chapter,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
					className: panel_module_css_default.chapterAside,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: panel_module_css_default.backLink,
							onClick: onBack,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutline14, {}), t("back")]
						}),
						chapter && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.chapterMeta,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: panel_module_css_default.chapterName,
									children: chapter.title
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: panel_module_css_default.chapterId,
									children: [
										chapter.id,
										" · ",
										t("difficulty"),
										" ",
										chapter.difficulty
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusBadge, {
									status: chapter.progress.status,
									t
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("nav", {
							className: panel_module_css_default.tabs,
							children: tabs.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: tab === item.id ? `${panel_module_css_default.tab} ${panel_module_css_default.tabActive}` : panel_module_css_default.tab,
								onClick: () => setTab(item.id),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.tabIcon,
									"aria-hidden": true,
									children: item.icon
								}), item.label]
							}, item.id))
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: panel_module_css_default.chapterMain,
					children: content === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Note, { children: t("loading") }) : body ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: body }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Note, { children: [
						t(tab === "lecture" ? "lecture" : "source"),
						" ",
						t("notGenerated")
					] })
				})]
			});
		}
		//#endregion
		//#region src/client/store.ts
		function createDashboardStore() {
			let state = {
				open: false,
				workspacePath: null,
				refreshKey: 0
			};
			const listeners = /* @__PURE__ */ new Set();
			const emit = () => {
				for (const listener of [...listeners]) listener();
			};
			return {
				getSnapshot: () => state,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				open: (workspacePath) => {
					state = {
						open: true,
						workspacePath,
						refreshKey: state.refreshKey + 1
					};
					emit();
				},
				close: () => {
					state = {
						...state,
						open: false
					};
					emit();
				},
				refresh: () => {
					state = {
						...state,
						refreshKey: state.refreshKey + 1
					};
					emit();
				}
			};
		}
		//#endregion
		//#region src/client/locales.ts
		/** Copy dictionaries for the ProMentor dashboard surface. */
		/** Simplified Chinese dictionary and key source of truth. */
		const zh = {
			dockLabel: "ProMentor",
			dockOpen: "打开 ProMentor Dashboard",
			dockClose: "关闭 Dashboard",
			title: "ProMentor Dashboard",
			workspace: "项目",
			noWorkspace: "当前会话没有可用的工作目录。",
			refresh: "刷新",
			close: "关闭",
			loading: "正在读取 .promentor/ …",
			noCourse: "还没有课程",
			noCourseHint: "未在项目根目录找到 .promentor/。请先让 Agent 运行 /promentor init 生成课程。",
			overall: "总体进度",
			chaptersDone: "章节完成",
			currentLearning: "当前学习",
			done: "已完成",
			learning: "学习中",
			notStarted: "未开始",
			chapter: "章节",
			titleCol: "标题",
			difficulty: "难度",
			status: "状态",
			score: "分数",
			attempts: "尝试",
			missingFiles: "内容不完整",
			back: "返回总览",
			lecture: "讲义",
			source: "源码导读",
			chapterNotFound: "未找到章节",
			empty: "（无内容）",
			notGenerated: "尚未生成"
		};
		/** English dictionary checked against the Chinese key set. */
		const en = {
			dockLabel: "ProMentor",
			dockOpen: "Open ProMentor Dashboard",
			dockClose: "Close dashboard",
			title: "ProMentor Dashboard",
			workspace: "Project",
			noWorkspace: "This session has no usable working directory.",
			refresh: "Refresh",
			close: "Close",
			loading: "Reading .promentor/ …",
			noCourse: "No course yet",
			noCourseHint: "No .promentor/ found in the project root. Ask the agent to run /promentor init first.",
			overall: "Overall progress",
			chaptersDone: "chapters done",
			currentLearning: "Now learning",
			done: "Completed",
			learning: "In progress",
			notStarted: "Not started",
			chapter: "Chapter",
			titleCol: "Title",
			difficulty: "Difficulty",
			status: "Status",
			score: "Score",
			attempts: "Attempts",
			missingFiles: "Incomplete content",
			back: "Back to overview",
			lecture: "Lecture",
			source: "Source guide",
			chapterNotFound: "Chapter not found",
			empty: "（empty）",
			notGenerated: "Not generated yet"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "promentor";
		/** Services required by the dock trigger, the overlay panel, and the locale registration. */
		const inject = [
			"slots",
			"locale",
			"sessions"
		];
		function apply(ctx) {
			const store = createDashboardStore();
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-promentor: dictionaries");
			const triggerActions = (sessionId) => ({
				getSnapshot: store.getSnapshot,
				subscribe: store.subscribe,
				open: () => {
					const summary = ctx.sessions.list.getSnapshot().byId[sessionId];
					store.open(summary?.cwd ?? null);
				},
				close: () => store.close(),
				getWorkspace: () => ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd ?? null
			});
			const panelActions = () => ({
				getSnapshot: store.getSnapshot,
				subscribe: store.subscribe,
				close: () => store.close(),
				refresh: () => store.refresh()
			});
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "promentor",
				order: 20,
				locale: NS,
				inject: triggerActions
			}, DashboardTrigger));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "promentor",
				order: 10,
				locale: NS,
				inject: panelActions
			}, DashboardPanel));
		}
		//#endregion
		exports.DashboardPanel = DashboardPanel;
		exports.DashboardTrigger = DashboardTrigger;
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map