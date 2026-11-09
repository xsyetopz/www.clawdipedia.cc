import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

import { z } from "zod";

import transcript from "../../../schemas/claude-code-transcript.json" with { type: "json" };
import { isRecord } from "./json.ts";

export const configDir = (): string => {
	const dir = process.env["CLAUDE_CONFIG_DIR"];
	return dir === undefined || dir === "" ? join(homedir(), ".claude") : dir;
};
const projectsDir = () => join(configDir(), "projects");

export interface SessionFile {
	id: string;
	project: string;
	path: string;
	bytes: number;
	modified: string;
}

const namesIn = async (dir: string): Promise<string[]> => {
	try {
		return await readdir(dir);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return [];
		}
		throw error;
	}
};

const sessionsIn = async (
	root: string,
	project: string,
): Promise<SessionFile[]> => {
	const dir = join(root, project);
	const info = await stat(dir);
	if (!info.isDirectory()) {
		return [];
	}
	const names = await readdir(dir);
	const files = names.filter((f) => f.endsWith(".jsonl"));
	return Promise.all(
		files.map(async (f) => {
			const path = join(dir, f);
			const st = await stat(path);
			return {
				id: basename(f, ".jsonl"),
				project,
				path,
				bytes: st.size,
				modified: st.mtime.toISOString(),
			};
		}),
	);
};

/** Every session file, newest first. `project` keeps those whose project folder name contains it. */
export const listSessions = async (
	project?: string,
): Promise<SessionFile[]> => {
	const root = projectsDir();
	const all = await namesIn(root);
	const names = all.filter((p) => p.includes(project ?? ""));
	const found = await Promise.all(names.map((p) => sessionsIn(root, p)));
	return found.flat().toSorted((a, b) => b.modified.localeCompare(a.modified));
};

/** Every session file plus the subagent transcripts under <session>/subagents/, where the tool calls of subagents are. */
export const listTranscripts = async (
	project?: string,
): Promise<SessionFile[]> => {
	const sessions = await listSessions(project);
	const withSubs = await Promise.all(
		sessions.map(async (s) => {
			const dir = join(dirname(s.path), s.id, "subagents");
			const names = await namesIn(dir);
			const subs = names
				.filter((f) => f.endsWith(".jsonl"))
				.map((f) => ({
					id: `${s.id}/${basename(f, ".jsonl")}`,
					project: s.project,
					path: join(dir, f),
					bytes: s.bytes,
					modified: s.modified,
				}));
			return { s, subs };
		}),
	);
	const all: SessionFile[] = [];
	for (const { s, subs } of withSubs) {
		all.push(s, ...subs);
	}
	return all;
};

/** The file of a session: a path to a .jsonl file, or a session id (a prefix works when it is unique). */
export const sessionPath = async (session: string): Promise<string> => {
	if (session.endsWith(".jsonl") && (await Bun.file(session).exists())) {
		return session;
	}
	const sessions = await listSessions();
	const hits = sessions.filter((s) => s.id.startsWith(session));
	const exact = hits.find((s) => s.id === session);
	if (exact) {
		return exact.path;
	}
	const [only] = hits;
	if (hits.length === 1 && only) {
		return only.path;
	}
	throw new Error(
		hits.length > 0
			? `session "${session}" matches ${hits.length} sessions: ${hits
					.slice(0, 5)
					.map((s) => s.id)
					.join(", ")}`
			: `no session "${session}" under ${projectsDir()}`,
	);
};

export interface Line {
	n: number;
	text: string;
	json?: { type?: unknown; [k: string]: unknown };
}

const lineOf = (text: string, n: number): Line => {
	try {
		const json: unknown = JSON.parse(text);
		return isRecord(json) ? { n, text, json } : { n, text };
	} catch {
		return { n, text };
	}
};

/** The lines of a session file, numbered from 1; `json` is unset when a line is not a JSON object. */
export const readLines = async (path: string): Promise<Line[]> => {
	const text = await Bun.file(path).text();
	return text
		.split("\n")
		.flatMap((l, i) => (l.trim() === "" ? [] : [lineOf(l, i + 1)]));
};

type Schema = Record<string, unknown>;
const defs: Record<string, Schema> = transcript.$defs;
const typeConst = (d: Schema): unknown => {
	const props = d["properties"];
	const type = isRecord(props) ? props["type"] : undefined;
	return isRecord(type) ? type["const"] : undefined;
};
/** Definition name by the `type` const it requires. */
const byType = new Map<string, string>();
for (const [name, d] of Object.entries(defs)) {
	const t = typeConst(d);
	if (typeof t === "string") {
		byType.set(t, name);
	}
}
const validators = new Map<string, z.ZodType>();
const validator = (def: string): z.ZodType => {
	let v = validators.get(def);
	if (!v) {
		v = z.fromJSONSchema({ ...defs[def], $defs: defs });
		validators.set(def, v);
	}
	return v;
};

export const SCHEMA_VERSION = /\d+\.\d+\.\d+/u.exec(transcript.title)?.[0];

/** Problems of one line: empty when it fits the schema of its `type`. */
export const checkLine = (line: Line): string[] => {
	if (!line.json) {
		return ["not JSON"];
	}
	const t = line.json.type;
	const def = typeof t === "string" ? byType.get(t) : undefined;
	if (def === undefined) {
		return [`unknown type ${JSON.stringify(t)}`];
	}
	const r = validator(def).safeParse(line.json);
	return r.success
		? []
		: r.error.issues.map(
				(i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
			);
};

export type ToolCalls = Record<string, { count: number; samples: string[] }>;

interface ToolUse {
	name: string;
	input: unknown;
}

const toolUses = (l: Line): ToolUse[] => {
	if (l.json?.type !== "assistant") {
		return [];
	}
	const message = l.json["message"];
	const content: unknown = isRecord(message) ? message["content"] : undefined;
	if (!Array.isArray(content)) {
		return [];
	}
	return content.flatMap((b: unknown) =>
		isRecord(b) && b["type"] === "tool_use" && typeof b["name"] === "string"
			? [{ name: b["name"], input: b["input"] }]
			: [],
	);
};

const sampleOf = (input: unknown, maxChars: number): string => {
	const s = JSON.stringify(input ?? null);
	return s.length > maxChars
		? `${s.slice(0, maxChars)}… (${s.length - maxChars} more chars)`
		: s;
};

/** Count the `tool_use` blocks of assistant lines by tool name, adding to `into`. A name that `match`
 * accepts keeps up to `samples` inputs as JSON, each cut to `maxChars`. */
export const scanToolCalls = (
	lines: Line[],
	opts: {
		match?: RegExp | undefined;
		samples?: number;
		maxChars?: number;
	} = {},
	into: ToolCalls = {},
): ToolCalls => {
	const { match, samples = 0, maxChars = 2000 } = opts;
	for (const { name, input } of lines.flatMap((l) => toolUses(l))) {
		if (match && !match.test(name)) {
			continue;
		}
		const c = into[name] ?? { count: 0, samples: [] };
		into[name] = c;
		c.count++;
		if (match && c.samples.length < samples) {
			c.samples.push(sampleOf(input, maxChars));
		}
	}
	return into;
};
