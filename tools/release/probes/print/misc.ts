// Remaining one-off print probes from p305-print misc.ts, misc2.ts, misc3.ts:
// agent mcpServers, plugin validate, subprocess env scrub, /context, managed settings path, large CLAUDE.md.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { scrubEnv, scrubPerm } from "./misc/scrub.ts";
import { BASE, MARK } from "./misc/shared.ts";
import { VALIDATE, validateCase } from "./misc/validate.ts";
import {
  type CaseDef,
  evKinds,
  json,
  msgs,
  readCfg,
  runCases,
  toolNames,
  toolResultTexts,
  withRun,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const SRV = `const fs=require("fs");const d=process.env.MARK_DIR;fs.writeFileSync(d+"/started","1");process.on("exit",()=>fs.writeFileSync(d+"/stopped","1"));process.on("SIGTERM",()=>process.exit(0));
let buf="";process.stdin.on("data",c=>{buf+=c;let i;while((i=buf.indexOf("\\n"))>=0){const l=buf.slice(0,i);buf=buf.slice(i+1);if(!l.trim())continue;let m;try{m=JSON.parse(l)}catch{continue}const s=r=>process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:r})+"\\n");if(m.method==="initialize")s({protocolVersion:m.params?.protocolVersion||"2025-06-18",capabilities:{tools:{}},serverInfo:{name:"p",version:"1"}});else if(m.method==="tools/list")s({tools:[{name:"ping",description:"p",inputSchema:{type:"object",properties:{}}}]});else if(m.id!==undefined)s({});}});process.stdin.on("end",()=>process.exit(0));`;

const agentMcp = (where: "user" | "project"): CaseDef => ({
  name: `agent-mcp-servers.${where}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        args: BASE,
        stub: {
          seq: [
            {
              name: "Agent",
              input: {
                description: "d",
                prompt: MARK,
                subagent_type: "pa",
                run_in_background: false,
              },
            },
          ],
        },
        setup: ({ cfg, home, proj }) => {
          const d = `${home}/mark`;
          mkdirSync(d, { recursive: true });
          writeFileSync(`${d}/srv.js`, SRV);
          const p =
            where === "user"
              ? `${cfg}/agents/pa.md`
              : `${proj}/.claude/agents/pa.md`;
          mkdirSync(dirname(p), { recursive: true });
          writeFileSync(
            p,
            `---\nname: pa\ndescription: probe agent\nmcpServers:\n  - agentsrv:\n      command: bun\n      args: ["${d}/srv.js"]\n      env:\n        MARK_DIR: "${d}"\n---\nHello.\n`,
          );
        },
        afterExit: ({ home }) => ({
          started: existsSync(`${home}/mark/started`),
          stopped: existsSync(`${home}/mark/stopped`),
        }),
      },
      (r) => {
        return {
          from: r,
          data: {
            precondition: msgs(r).length >= 2,
            started: r.after["started"] === true,
            stopped: r.after["stopped"] === true,
            handBack: (toolResultTexts(r)[0] ?? "").includes(
              "[Subagent hand-back]",
            ),
          },
        };
      },
    ),
});

const contextCmd: CaseDef = {
  name: "context-slash-command",
  run: (ctx) =>
    withRun(
      ctx,
      {
        prompt: "/context",
        promptReason: "the slash command is the behaviour under test",
      },
      (r) => ({
        from: r,
        data: {
          precondition: r.code !== null,
          requests: r.reqs.length,
          paths: [...new Set(r.reqs.map((x) => x.path.split("?")[0] ?? ""))],
          countTokens: r.reqs.filter((x) => x.path.includes("count_tokens"))
            .length,
          messageRequests: msgs(r).length,
        },
      }),
    ),
};

const managedPath: CaseDef = {
  name: "managed-settings-path",
  run: (ctx) =>
    withRun(
      ctx,
      {
        env: { CLAUDE_CODE_MANAGED_SETTINGS_PATH: "{HOME}/ms.json" },
        homeFiles: { "ms.json": json({ permissions: { deny: ["Bash"] } }) },
        args: ["--debug-file", "{CFG}/d.log"],
      },
      (r) => {
        const q = msgs(r)[0];
        const d = readCfg(r, "d.log");
        return {
          from: r,
          data: {
            precondition: !!q && d.length > 0,
            bashToolPresent: q ? toolNames(q).includes("Bash") : null,
            defaultManagedFileChecked: /managed-settings\.json/.test(d),
          },
          samples: {
            managedDebugLines: d
              .split("\n")
              .filter((l) => /managed/i.test(l))
              .slice(0, 3)
              .map((l) => l.replace(/^\S+\s/, "").slice(0, 200))
              .join("\n"),
          },
        };
      },
    ),
};

const BIG = "x".repeat(45_000);
const stripX = (s: string) => s.replace(/x{50,}/g, "<xs>");
const bigClaudeMd: CaseDef = {
  name: "large-claude-md",
  run: (ctx) =>
    withRun(ctx, { projFiles: { "CLAUDE.md": BIG } }, async (r) => {
      const t = stripX(r.stdout + r.stderr);
      const doc = await withRun(
        ctx,
        {
          argv: ["doctor"],
          noPrompt: true,
          projFiles: { "CLAUDE.md": BIG },
          timeoutMs: 30_000,
        },
        (d) => stripX(d.stdout + d.stderr),
      );
      const st = await withRun(
        ctx,
        {
          noPrompt: true,
          argv: [
            "-p",
            "--input-format",
            "stream-json",
            "--output-format",
            "stream-json",
            "--verbose",
          ],
          stdin: `${json({ type: "control_request", request_id: "g1", request: { subtype: "get_status" } })}\n`,
          projFiles: { "CLAUDE.md": BIG },
        },
        (g) => {
          const line =
            g.stdout.split("\n").find((l) => l.includes("control_response")) ??
            "";
          let titles = "";
          try {
            const j = JSON.parse(line) as {
              response: { response: { sections: { title: string }[] } };
            };
            titles = j.response.response.sections.map((s) => s.title).join("|");
          } catch {
            // leave empty
          }
          return { titles, mentions: /Large CLAUDE|exceeds|chars/i.test(line) };
        },
      );
      return {
        from: r,
        data: {
          precondition: msgs(r).length > 0 && st.titles.length > 0,
          printWarns: /Large CLAUDE|exceeds|memory files/i.test(t),
          doctorWarns: /Large CLAUDE|exceed|memory files/i.test(doc),
          getStatusSections: st.titles,
          getStatusMentionsSize: st.mentions,
          events: evKinds(r),
        },
        notes:
          "Three runs (-p, doctor, get_status control request); the doctor and get_status runs send no prompt.",
      };
    }),
};

// The nested file loads after a Read under its folder; a model with each window shows which limit cuts it.
const nestedClaudeMd = (model: string): CaseDef => ({
  name: `nested-claude-md-over-limit.${model}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        model,
        projFiles: {
          "sub/CLAUDE.md": `NESTED-BEGIN${"y".repeat(200_000)}NESTED-END`,
          "sub/f.txt": "x\n",
        },
        stub: {
          seq: [{ name: "Read", input: { file_path: "{PROJ}/sub/f.txt" } }],
        },
      },
      (r) => {
        const body = JSON.stringify(msgs(r).at(-1)?.body ?? "");
        const at = body.indexOf("NESTED-BEGIN");
        return {
          from: r,
          data: {
            precondition: msgs(r).length >= 2,
            nestedLoaded: at >= 0,
            endKept: body.includes("NESTED-END"),
            charsKept:
              at >= 0 ? (/^y*/.exec(body.slice(at + 12))?.[0].length ?? 0) : 0,
          },
          samples: {
            after:
              at >= 0
                ? stripX(body.slice(at + 12).replace(/^y+/, "<ys>")).slice(
                    0,
                    300,
                  )
                : "",
          },
        };
      },
    ),
});

export const misc: PrintGroup = {
  id: "misc",
  title:
    "Agent mcpServers, plugin validate, env scrub, /context, managed settings path, large CLAUDE.md",
  run: (ctx) =>
    runCases(ctx, "misc", [
      agentMcp("user"),
      agentMcp("project"),
      ...VALIDATE.map(validateCase),
      scrubEnv,
      scrubPerm(false, "1"),
      scrubPerm(false, "0"),
      scrubPerm(true, "1"),
      scrubPerm(true, "0"),
      contextCmd,
      managedPath,
      bigClaudeMd,
      nestedClaudeMd("claude-opus-5-5"),
      nestedClaudeMd("claude-sonnet-4-5"),
    ]),
};
