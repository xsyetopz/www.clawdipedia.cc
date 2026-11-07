// Configure and memory probes (ported from p305-print cfgmem.ts, cow.ts, stores.ts, stores2.ts).
import { mkdirSync, writeFileSync } from "node:fs";
import {
  bodyOf,
  type CaseDef,
  evKinds,
  fixed,
  initEvent,
  json,
  msgs,
  type Run,
  readCfg,
  runCases,
  sysText,
  toolNames,
  withRun,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

/** Everything the model sees first: system blocks plus messages. */
const allText = (r: Run): string => {
  const q = msgs(r)[0];
  return q ? fixed(r, `${sysText(q)}\n${json(bodyOf(q).messages)}`) : "";
};
const memSection = (r: Run): string => {
  const s = fixed(r, sysText(msgs(r)[0] as never));
  const i = s.indexOf("# Memory");
  return i < 0
    ? ""
    : s.slice(
        i,
        s.indexOf("\n# ", i + 5) < 0 ? undefined : s.indexOf("\n# ", i + 5),
      );
};
const memTools = (r: Run): string[] =>
  toolNames(msgs(r)[0] as never).filter((n) => /memory/i.test(n));

const outputStyle: CaseDef = {
  name: "output-style.plugin-forced",
  run: (ctx) =>
    withRun(
      ctx,
      {
        args: ["--plugin-dir", "{HOME}/plug"],
        cfgFiles: {
          "settings.json": json({ outputStyle: "userstyle" }),
          "output-styles/userstyle.md":
            "---\nname: userstyle\ndescription: u\n---\nZZUSERSTYLEZZ text.\n",
        },
        setup: ({ home }) => {
          const pl = `${home}/plug`;
          mkdirSync(`${pl}/.claude-plugin`, { recursive: true });
          mkdirSync(`${pl}/output-styles`, { recursive: true });
          writeFileSync(
            `${pl}/.claude-plugin/plugin.json`,
            json({ name: "pp", version: "1.0.0", description: "x" }),
          );
          writeFileSync(
            `${pl}/output-styles/forced.md`,
            "---\nname: forced\ndescription: forced style\nforce-for-plugin: true\n---\nZZFORCEDSTYLEZZ text.\n",
          );
        },
      },
      (r) => {
        const s = msgs(r)[0] ? json(bodyOf(msgs(r)[0] as never)) : "";
        return {
          from: r,
          data: {
            precondition: s.length > 0,
            forcedStyleInSystem: s.includes("ZZFORCEDSTYLEZZ"),
            userStyleInSystem: s.includes("ZZUSERSTYLEZZ"),
            initOutputStyle: (initEvent(r)?.["output_style"] as string) ?? null,
          },
        };
      },
    ),
};

const MEM_ENVS: [string, Record<string, string>][] = [
  ["plain", {}],
  ["remote", { CLAUDE_CODE_REMOTE: "1" }],
  [
    "remote-dir",
    {
      CLAUDE_CODE_REMOTE: "1",
      CLAUDE_CODE_REMOTE_MEMORY_DIR: "{HOME}/ZZMEMDIR",
    },
  ],
  [
    "stores-object",
    { CLAUDE_MEMORY_STORES: json([{ name: "s1", path: "{HOME}/ZZMEMDIR2" }]) },
  ],
];
const memCase = ([name, env]: (typeof MEM_ENVS)[number]): CaseDef => ({
  name: `memory.${name}`,
  run: (ctx) =>
    withRun(ctx, { env }, (r) => {
      const sys = fixed(r, sysText(msgs(r)[0] as never));
      return {
        from: r,
        data: {
          precondition: sys.length > 0,
          memHeading: /^# Memory/m.test(sys),
          autoMemoryWord:
            /auto memory|memory directory|persistent memory/i.test(sys),
          systemChars: sys.length,
          memoryTools: memTools(r),
          memdirInSystem: /ZZMEMDIR/.test(sys),
          events: evKinds(r),
        },
      };
    }),
});

const COW: [string, Record<string, string>][] = [
  ["plain", {}],
  ["path-override", { CLAUDE_COWORK_MEMORY_PATH_OVERRIDE: "{HOME}/ZZCOWPATH" }],
  ["guidelines", { CLAUDE_COWORK_MEMORY_GUIDELINES: "ZZGUIDEZZ" }],
  ["extra-guidelines", { CLAUDE_COWORK_MEMORY_EXTRA_GUIDELINES: "ZZEXTRAZZ" }],
  ["index-content", { CLAUDE_COWORK_MEMORY_INDEX_CONTENT: "ZZINDEXZZ" }],
  [
    "remote-path-override",
    {
      CLAUDE_CODE_REMOTE: "1",
      CLAUDE_COWORK_MEMORY_PATH_OVERRIDE: "{HOME}/ZZCOWPATH",
    },
  ],
  [
    "post-turn",
    {
      CLAUDE_CODE_POST_TURN_MEMORY: "1",
      CLAUDE_CODE_POST_TURN_MEMORY_CONFIG: json({ instruction: "x" }),
    },
  ],
];
const cowCase = ([name, env]: (typeof COW)[number]): CaseDef => ({
  name: `cowork-memory.${name}`,
  run: (ctx) =>
    withRun(ctx, { env, args: ["--debug-file", "{CFG}/d.log"] }, (r) => {
      const t = allText(r);
      const d = readCfg(r, "d.log");
      return {
        from: r,
        data: {
          precondition: t.length > 0 && d.length > 0,
          systemChars: t.length,
          markers: ["ZZCOWPATH", "ZZGUIDEZZ", "ZZEXTRAZZ", "ZZINDEXZZ"].filter(
            (m) => t.includes(m),
          ),
          memHeading: /# Memory/.test(t),
          debugLine: (
            d.match(/.*(CCR memory server|post-turn|PostTurn).*/i)?.[0] ?? ""
          )
            .replace(/^\S+\s/, "")
            .slice(0, 160),
        },
      };
    }),
});

// The stub answers as the cloud memory server, at the origin that ANTHROPIC_BASE_URL names (the ingress host fallback).
const postTurnMounted: CaseDef = {
  name: "cowork-memory.post-turn-mounted",
  run: (ctx) =>
    withRun(
      ctx,
      {
        env: {
          CLAUDE_CODE_POST_TURN_MEMORY: "1",
          CLAUDE_CODE_POST_TURN_MEMORY_CONFIG: json({
            instruction: "ZZPOSTTURNZZ",
          }),
        },
        args: [
          "--debug-file",
          "{CFG}/d.log",
          "--mcp-config",
          json({
            mcpServers: { memory: { type: "http", url: "{MEMORY_MCP}" } },
          }),
        ],
      },
      (r) => {
        const d = readCfg(r, "d.log");
        return {
          from: r,
          data: {
            precondition: msgs(r).length > 0 && d.length > 0,
            memoryMcpRequests: r.reqs.filter((q) =>
              q.path.endsWith("/memory/mcp"),
            ).length,
            memoryToolsListed: toolNames(msgs(r)[0] as never).filter((n) =>
              n.startsWith("mcp__memory__"),
            ),
            notMounted: d.includes("CCR memory server not mounted"),
            instructionSent: msgs(r).some((q) =>
              json(q.body).includes("ZZPOSTTURNZZ"),
            ),
            messageRequests: msgs(r).length,
            extractLines: d
              .split("\n")
              .filter((l) => l.includes("[extractMemories]"))
              .map((l) => l.replace(/^\S+\s/, "").slice(0, 200)),
          },
        };
      },
    ),
};

const FORMS: [string, string][] = [
  ["object-name-path", json([{ name: "s1", path: "{HOME}/ZZMEMDIR2" }])],
  ["string-array", json(["s1", "s2"])],
  ["empty-array", "[]"],
  ["garbage", "garbage"],
  ["id-mount-form", json([{ id: "memstore_01", name: "s1", mount: "/mnt/m" }])],
];
const formCase = ([name, f]: [string, string]): CaseDef => ({
  name: `memory-stores.${name}`,
  run: (ctx) =>
    withRun(ctx, { env: { CLAUDE_MEMORY_STORES: f } }, (r) => {
      const m = memSection(r);
      return {
        from: r,
        data: {
          precondition: !!msgs(r)[0],
          sectionChars: m.length,
          mentionsStore: /ZZMEMDIR2|\bs1\b|\/mnt\/m/.test(m),
          memoryTools: memTools(r),
        },
        samples: { sectionHead: m.slice(0, 300) },
      };
    }),
});
const modeCase = (mode: "rw" | "ro"): CaseDef => ({
  name: `memory-stores.mode-${mode}`,
  run: (ctx) =>
    withRun(
      ctx,
      { env: { CLAUDE_MEMORY_STORES: json([{ path: "{HOME}/st", mode }]) } },
      (r) => {
        const m = memSection(r);
        return {
          from: r,
          data: {
            precondition: !!msgs(r)[0],
            sectionChars: m.length,
            readOnlyNote: m.includes("read-only"),
            teamDir: /memory\/team\/st/.test(m),
            memoryTools: memTools(r),
          },
          samples: { sectionHead: m.slice(0, 300) },
        };
      },
    ),
});

export const configmem: PrintGroup = {
  id: "configmem",
  title:
    "Configure and memory (output style, remote memory, Cowork memory, memory stores)",
  run: (ctx) =>
    runCases(ctx, "configmem", [
      outputStyle,
      ...MEM_ENVS.map(memCase),
      ...COW.map(cowCase),
      postTurnMounted,
      ...FORMS.map(formCase),
      modeCase("rw"),
      modeCase("ro"),
    ]),
};
