import { z } from "zod";

import {
	checkLine,
	configDir,
	listSessions,
	listTranscripts,
	readLines,
	scanToolCalls,
	SCHEMA_VERSION,
	sessionPath,
	type ToolCalls,
} from "../sessions.ts";
import { clip, group, has, MAX_CHARS, need, P, regex, text } from "./app.ts";

interface Hit {
	session: string;
	line: number;
	type: unknown;
	snippet: string;
}

// One file at a time, so that a search stops reading at `limit` hits.
const searchFiles = async (
	files: { id: string; path: string }[],
	re: RegExp,
	limit: number,
	hits: Hit[] = [],
	at = 0,
): Promise<Hit[]> => {
	const f = files[at];
	if (f === undefined || hits.length >= limit) {
		return hits;
	}
	const lines = await readLines(f.path);
	for (const l of lines) {
		const m = re.exec(l.text);
		if (!m) {
			continue;
		}
		const from = Math.max(0, m.index - 100);
		hits.push({
			session: f.id,
			line: l.n,
			type: l.json?.type,
			snippet: l.text.slice(from, m.index + m[0].length + 100),
		});
		if (hits.length >= limit) {
			break;
		}
	}
	return searchFiles(files, re, limit, hits, at + 1);
};

group(
	"sessions",
	"Read Claude Code session transcripts: list, read, search, or validate them against the transcript schema, or count tool calls by name.",
	"action",
	{
		list: async ({ project, limit = 20 }) => {
			const all = await listSessions(project);
			const sessions = all.slice(0, limit);
			return text(
				sessions.length > 0
					? `${all.length} sessions under ${configDir()}/projects${all.length > limit ? `, showing ${limit}` : ""}:\n${sessions
							.map(
								(s) =>
									`- ${s.id}  ${s.project}  ${Math.round(s.bytes / 1024)} KB  ${s.modified}`,
							)
							.join("\n")}`
					: `No sessions under ${configDir()}/projects${has(project) ? ` for "${project}"` : ""}.`,
				{ sessions },
			);
		},
		read: async ({
			session,
			type,
			offset = 0,
			limit = 20,
			max_line_chars = 2000,
		}) => {
			const path = await sessionPath(need(session, "session"));
			const all = await readLines(path);
			const lines = all.filter((l) => !has(type) || l.json?.type === type);
			const page = lines.slice(offset, offset + limit);
			const more = offset + page.length < lines.length;
			return text(
				`${path}: lines ${offset + 1}-${offset + page.length} of ${lines.length}${has(type) ? ` with type "${type}"` : ""}${more ? `, next_offset ${offset + page.length}` : ""}\n${page
					.map((l) => `${l.n}: ${clip(l.text, max_line_chars)}`)
					.join("\n")}`,
			);
		},
		search: async ({
			query,
			regex: isRegex = false,
			session,
			project,
			limit = 20,
		}) => {
			const re = regex(need(query, "query"), isRegex);
			const files = has(session)
				? [{ id: session, path: await sessionPath(session) }]
				: await listSessions(project);
			const hits = await searchFiles(files, re, limit);
			return text(
				hits.length > 0
					? hits
							.map(
								(h) =>
									`- ${h.session}:${h.line} [${String(h.type)}] …${h.snippet}…`,
							)
							.join("\n")
					: `No match for ${re} in ${files.length} sessions.`,
				{ hits },
			);
		},
		validate: async ({ session, limit = 20 }) => {
			const path = await sessionPath(need(session, "session"));
			const lines = await readLines(path);
			const byType: Record<string, { lines: number; failed: number }> = {};
			const failures: { line: number; type: unknown; problems: string[] }[] =
				[];
			for (const l of lines) {
				const t = String(l.json?.type);
				const c = byType[t] ?? { lines: 0, failed: 0 };
				byType[t] = c;
				c.lines++;
				const problems = checkLine(l);
				if (problems.length === 0) {
					continue;
				}
				c.failed++;
				failures.push({ line: l.n, type: l.json?.type, problems });
			}
			const shown = failures.slice(0, limit);
			return text(
				`${path}: ${lines.length} lines, ${failures.length} fail the ${SCHEMA_VERSION} schema.\n${Object.entries(
					byType,
				)
					.map(([t, c]) => `- ${t}: ${c.lines} lines, ${c.failed} fail`)
					.join(
						"\n",
					)}${shown.length > 0 ? `\n\nFailures:\n${shown.map((f) => `- line ${f.line} [${String(f.type)}]: ${f.problems.slice(0, 5).join("; ")}`).join("\n")}` : ""}`,
				{
					lines: lines.length,
					failed: failures.length,
					byType,
					failures: shown,
				},
			);
		},
		"tool-calls": async ({
			query,
			regex: isRegex = false,
			session,
			project,
			limit = 20,
			max_line_chars = 2000,
		}) => {
			const match = has(query) ? regex(query, isRegex) : undefined;
			const files = has(session)
				? [{ id: session, path: await sessionPath(session) }]
				: await listTranscripts(project);
			const tools: ToolCalls = {};
			const linesOf = await Promise.all(files.map((f) => readLines(f.path)));
			for (const lines of linesOf) {
				scanToolCalls(
					lines,
					{ match, samples: limit, maxChars: max_line_chars },
					tools,
				);
			}
			const rows = Object.entries(tools).toSorted(
				(a, b) => b[1].count - a[1].count,
			);
			return text(
				rows.length > 0
					? rows
							.map(
								([name, c]) =>
									`${c.count} ${name}${c.samples.map((s) => `\n    ${s}`).join("")}`,
							)
							.join("\n")
					: `No tool calls${match ? ` matching ${match}` : ""} in ${files.length} sessions.`,
				{ tools },
			);
		},
	},
	{
		session: z
			.string()
			.optional()
			.describe("Session id, unique prefix, or .jsonl path."),
		project: z
			.string()
			.optional()
			.describe("Keep project folders whose name contains this."),
		type: z.string().optional().describe('Keep lines with this "type" (read).'),
		query: P.query,
		regex: P.regex,
		offset: P.offset,
		limit: P.limit,
		max_line_chars: z.number().int().min(100).max(MAX_CHARS).optional(),
	},
);
