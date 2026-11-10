import { listInstalls } from "../binary.ts";
import {
	bodyOf,
	linesWith,
	outcomeLines,
	placesOf,
	resultText,
	toolEntry,
	toolNames,
} from "../requests.ts";
import {
	API_HOST,
	runArgs,
	runPrompt,
	type RunResult,
	userText,
} from "../run.ts";
import { type Args, clip, has, need, type Out, regex, text } from "./app.ts";

type RunOpts = NonNullable<Parameters<typeof runArgs>[2]>;
type Calls = NonNullable<RunOpts["calls"]>;

const STREAM_FLAGS = [
	"-p",
	"--input-format",
	"stream-json",
	"--output-format",
	"stream-json",
	"--verbose",
];
const STDOUT_CHARS = 4000;
const STDERR_CHARS = 2000;
const SHOW_CHARS = 8000;
const PAGE_CHARS = 4000;
const OUTCOME_CHARS = 600;

/** Only an install: `run` and `cli` execute the file, where the other actions only read it. */
export const installed = async (version: string | undefined) => {
	const all = await listInstalls();
	const bin = has(version)
		? all.find((i) => i.version === version)
		: (all.find((i) => i.current) ?? all[0]);
	if (!bin) {
		throw new Error(
			`run and cli take an installed version; installed: ${all.map((i) => i.version).join(", ") || "none"}`,
		);
	}
	return bin;
};

const callsOf = (calls: NonNullable<Args["calls"]>): Calls => {
	const out: Calls = [];
	for (const c of calls) {
		const call: Calls[number] = { name: c.name, input: c.input };
		if (c.safeguard !== undefined) {
			call.safeguard = c.safeguard;
		}
		out.push(call);
	}
	return out;
};

const optionsOf = (a: Args): RunOpts => {
	const options: RunOpts = {
		env: a.env ?? {},
		files: a.files ?? {},
		replies: a.replies ?? {},
		login: a.login ?? "key",
		apiHost: a.apiHost ?? false,
		baseUrl: a.baseUrl ?? true,
	};
	if (a.calls) {
		options.calls = callsOf(a.calls);
	}
	if (a.provider) {
		options.provider = a.provider;
	}
	if (a.fastRefusal !== undefined) {
		options.fastRefusal = a.fastRefusal;
	}
	if (a.prompts) {
		options.input = a.prompts
			.map(
				(content) =>
					`${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`,
			)
			.join("");
	}
	return options;
};

const requestBody = (
	r: RunResult,
	request: number,
	offset: number,
	length: number,
) => {
	const q = r.requests[request - 1];
	if (!q) {
		throw new Error(`no request ${request}; the run sent ${r.requests.length}`);
	}
	const json = typeof q.body === "string" ? q.body : JSON.stringify(q.body);
	const start = Math.min(offset, json.length);
	const end = Math.min(json.length, start + length);
	return {
		request,
		...bodyOf(q.body),
		offset: start,
		end,
		total: json.length,
		text: json.slice(start, end),
	};
};

const shownFile = (r: RunResult, { show, query, regex: isRegex }: Args) => {
	if (show === undefined) {
		return "";
	}
	const file = r.files[show] ?? r.projectFiles[show];
	if (file === undefined) {
		return `\n${show}: not written`;
	}
	const lines =
		query === undefined ? "" : linesWith(file, regex(query, isRegex ?? false));
	return `\n${show}: ${clip(file, SHOW_CHARS)}${lines === "" ? "" : `\n${show}, lines with the query: ${clip(lines, SHOW_CHARS)}`}`;
};

const toolText = (tool: string | undefined, entry: object | undefined) => {
	if (tool === undefined) {
		return "";
	}
	if (!entry) {
		return `\ntool ${tool}: not sent`;
	}
	const json = JSON.stringify(entry);
	return `\ntool ${tool}: ${Buffer.byteLength(json)} bytes\n${json}`;
};

const bodyText = (body: ReturnType<typeof requestBody> | undefined) =>
	body
		? `\nrequest ${body.request}: ${body.bytes} bytes (tools ${body.tools}, system ${body.system}, messages ${body.messages}), cache_control at: ${body.cacheControl.join(", ") || "none"}\nbody [${body.offset}, ${body.end}) of ${body.total}: ${body.text}`
		: "";

const sentOf = (r: RunResult) =>
	r.requests.map(
		(x) =>
			`${x.method} ${x.host === API_HOST ? `https://${API_HOST}` : ""}${x.path}`,
	);

const lookups = (r: RunResult, a: Args) => {
	const { query, request, tool } = a;
	return {
		found:
			query === undefined
				? undefined
				: placesOf(r, regex(query, a.regex ?? false)),
		body:
			request === undefined
				? undefined
				: requestBody(r, request, a.offset ?? 0, a.length ?? PAGE_CHARS),
		entry: tool === undefined ? undefined : toolEntry(r, tool),
	};
};

const summary = (r: RunResult, found: string[] | undefined) => {
	const sent = sentOf(r);
	const tools = toolNames(r);
	const toolsLine =
		tools.length > 0
			? `\ntools: ${tools.map((t) => t.join(" ")).join(" | ")}`
			: "";
	const foundLine = found
		? `\nquery found in: ${found.join("; ") || "nothing"}`
		: "";
	const files = Object.keys(r.files).join(", ") || "none";
	return {
		sent,
		tools,
		line: `exit ${r.exit}, requests: ${sent.join(", ") || "none"}, files: ${files}.${toolsLine}${foundLine}`,
	};
};

/** The `cli` action: run the installed program with other args and report what it sent and wrote. */
export const cli = async (a: Args): Promise<Out> => {
	const { args = [], prompts, version, tool } = a;
	if (args.length === 0 && !prompts) {
		throw new Error('cli needs args, such as ["auto-mode", "config"]');
	}
	const bin = await installed(version);
	const r = await runArgs(
		bin.path,
		prompts ? [...STREAM_FLAGS, ...args] : args,
		optionsOf(a),
	);
	const { found, body, entry } = lookups(r, a);
	const { sent, tools, line } = summary(r, found);
	const stdout = clip(r.stdout, STDOUT_CHARS);
	const stderr = clip(r.stderr, STDERR_CHARS);
	const outcomes = outcomeLines(r).map((l) => clip(l, OUTCOME_CHARS));
	return text(
		`${bin.version}: ${line}${outcomes.map((l) => `\n${l}`).join("")}\nstdout: ${stdout}\nstderr: ${stderr}${shownFile(r, a)}${bodyText(body)}${toolText(tool, entry)}`,
		{
			exit: r.exit,
			requests: sent,
			tools,
			found,
			outcomes,
			stdout,
			stderr,
			...(body && { body }),
			...(tool !== undefined && { tool: entry ?? null }),
		},
	);
};

/** The `run` action: send a prompt to the installed program and report the user turn it sent. */
export const runCode = async ({
	prompt,
	name,
	version,
	offset = 0,
	length = 4000,
	env,
}: Args): Promise<Out> => {
	const q = need(prompt, "prompt");
	const cmd = /^\/([\w:-]+)/u.exec(q)?.[1];
	const mark = name ?? (has(cmd) ? `<command-name>/${cmd}</command-name>` : q);
	const bin = await installed(version);
	const r = await runPrompt(bin.path, q, undefined, undefined, env);
	const t = userText(r, mark);
	const sent = r.requests.map((x) => `${x.method} ${x.path}`);
	const out = resultText(r);
	const said = out === null ? "" : `\nResult: ${clip(out, 2000)}`;
	const head = `${bin.version}: exit ${r.exit}, ${sent.length} requests.${r.exit !== 0 || t === null ? `\nstderr: ${clip(r.stderr, 500)}` : ""}`;
	if (t === null) {
		return text(`${head}\nNo user turn holds "${clip(mark, 100)}".${said}`, {
			exit: r.exit,
			requests: sent,
			result: out,
		});
	}
	const start = Math.min(offset, t.length);
	const end = Math.min(t.length, start + length);
	return text(
		`${head}\nUser turn [${start}, ${end}) of ${t.length}\n${t.slice(start, end)}${said}`,
		{
			exit: r.exit,
			requests: sent,
			offset: start,
			end,
			total: t.length,
			result: out,
		},
	);
};
