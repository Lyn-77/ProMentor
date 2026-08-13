import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";
//#region lib/types/index.js
/**
* ProMentor course data gateway (host half).
*
* The browser dashboard never touches the host filesystem directly: this
* plugin registers the `/promentor/data` webserver route, and the dashboard
* reads `.promentor/` (course.json, progress.json, chapters/*, submissions/*)
* of the workspace it is currently showing through that single read path.
*
* Every read is confined to the requested workspace's `.promentor/`
* directory: the workspace is canonicalized with fs.realpath, and the
* relative file path is normalized and must stay inside it.
*/
const name = "dsh-host-promentor";
/** Required services: the webserver route registry. */
const inject = ["webServer"];
/** The course data directory inside a workspace root. */
const DATA_DIR = ".promentor";
/** Route serving course data: GET/HEAD /promentor/data?ws=<abs path>&p=<rel path>. */
const ROUTE_PATH = "/promentor/data";
const CONTENT_TYPES = {
	".json": "application/json; charset=utf-8",
	".md": "text/markdown; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".yml": "text/yaml; charset=utf-8",
	".yaml": "text/yaml; charset=utf-8",
	".go": "text/plain; charset=utf-8",
	".py": "text/plain; charset=utf-8",
	".ts": "text/plain; charset=utf-8",
	".js": "text/plain; charset=utf-8",
	".rs": "text/plain; charset=utf-8",
	".java": "text/plain; charset=utf-8",
	".c": "text/plain; charset=utf-8",
	".h": "text/plain; charset=utf-8",
	".sh": "text/plain; charset=utf-8",
	".mod": "text/plain; charset=utf-8",
	".sum": "text/plain; charset=utf-8"
};
/** Respond with a plain status and no body. */
function sendStatus(res, status) {
	res.writeHead(status);
	res.end();
}
function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: ROUTE_PATH,
		handler: (req, res) => serveData(ctx, req, res)
	}), "dsh-host-promentor: data route");
}
async function serveData(ctx, req, res) {
	if (req.method !== "GET" && req.method !== "HEAD") {
		res.writeHead(405, { allow: "GET, HEAD" });
		res.end();
		return;
	}
	const url = new URL(req.url ?? "/", "http://dsh.local");
	const workspace = url.searchParams.get("ws");
	const rel = url.searchParams.get("p");
	if (workspace === null || rel === null) {
		sendStatus(res, 400);
		return;
	}
	try {
		const dataRoot = resolve(join(await realpath(workspace), DATA_DIR));
		const relPath = normalize(rel);
		if (relPath === "" || isAbsolute(relPath) || relPath.startsWith("..")) {
			sendStatus(res, 400);
			return;
		}
		const target = resolve(join(dataRoot, relPath));
		const inside = relative(dataRoot, target);
		if (inside.startsWith("..") || isAbsolute(inside)) {
			sendStatus(res, 403);
			return;
		}
		const info = await stat(target);
		if (!info.isFile()) {
			sendStatus(res, 404);
			return;
		}
		const type = CONTENT_TYPES[target.slice(target.lastIndexOf("."))] ?? "application/octet-stream";
		res.writeHead(200, {
			"content-type": type,
			"content-length": String(info.size),
			"cache-control": "no-cache"
		});
		if (req.method === "HEAD") {
			res.end();
			return;
		}
		res.end(await readFile(target));
	} catch (error) {
		if (error.code === "ENOENT" || error.code === "ENOTDIR") {
			sendStatus(res, 404);
			return;
		}
		ctx.logger.warn("[dsh-host-promentor] data read failed:", error);
		sendStatus(res, 500);
	}
}
//#endregion
export { apply, inject, name };
