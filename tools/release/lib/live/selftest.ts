// Offline self-test for the live pieces: env guards, planning, the mitm CA and fault replies, the pty live-token path.
// Uses a fake token only. Never reads .env and never touches the network. Called from ../selftest.ts.
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artifactsPanelShown } from "../../probes/live/artifacts.ts";
import { headerOf, typeaheadLines } from "../../probes/live/cli319.ts";
import { cacheMarker, planLive } from "../cache.ts";
import { childEnv } from "../env.ts";
import { startMitm, USAGE_PATH } from "../mitm.ts";
import { runPty } from "../pty/driver.ts";
import { writeSecurityShim } from "../shim.ts";
import { assertLiveEnv, DRY_TOKEN, liveEnv } from "./env.ts";

const throws = (f: () => unknown): boolean => {
  try {
    f();
    return false;
  } catch {
    return true;
  }
};

export const runLiveSelftest = async (
  step: (name: string, ok: boolean, detail?: string) => void,
): Promise<void> => {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), "ccrel-livesel-"));
  try {
    writeSecurityShim(dir);
    const env = liveEnv({ home: dir, configDir: dir, token: DRY_TOKEN });
    step(
      "liveEnv: token only, no base url, no api key, no proxy",
      env["CLAUDE_CODE_OAUTH_TOKEN"] === DRY_TOKEN &&
        !("ANTHROPIC_BASE_URL" in env) &&
        !("ANTHROPIC_API_KEY" in env) &&
        !("HTTPS_PROXY" in env),
    );
    const gates = liveEnv({
      home: dir,
      configDir: dir,
      token: DRY_TOKEN,
      featureGates: true,
    });
    step(
      "liveEnv: featureGates keeps telemetry and nonessential traffic on",
      env["DISABLE_TELEMETRY"] === "1" &&
        !("DISABLE_TELEMETRY" in gates) &&
        !("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC" in gates),
    );
    step(
      "assertLiveEnv rejects other credentials and a different token",
      throws(() => assertLiveEnv({ GH_TOKEN: "x" }, DRY_TOKEN)) &&
        throws(() => assertLiveEnv({ ANTHROPIC_API_KEY: "x" }, DRY_TOKEN)) &&
        throws(() =>
          assertLiveEnv({ CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-other" }, DRY_TOKEN),
        ) &&
        throws(() => assertLiveEnv({ FOO: DRY_TOKEN }, DRY_TOKEN)),
    );
    step(
      "childEnv still refuses the OAuth token",
      throws(() =>
        childEnv({
          home: dir,
          configDir: dir,
          baseUrl: "http://127.0.0.1:1/x",
          extra: { CLAUDE_CODE_OAUTH_TOKEN: DRY_TOKEN },
        }),
      ),
    );
    const marker1 = cacheMarker("x");
    const marker2 = cacheMarker("x");
    const planned = planLive([
      { id: "a" },
      { id: "b", coldSensitive: true },
      { id: "c" },
    ]).map((c) => c.id);
    step(
      "planLive: cold-sensitive first, markers unique",
      planned.join() === "b,a,c" && marker1 !== marker2,
    );

    const unknownScreen =
      "> /artifacts\n\n⏺ Unknown command: /artifacts\n\n/exit Exit the CLI\n/context Visualize current context usage\n";
    step(
      "artifacts probe: echoed command and Unknown command are not a panel",
      !artifactsPanelShown("> /artifacts\n") &&
        !artifactsPanelShown(unknownScreen) &&
        artifactsPanelShown("> /artifacts\n\n Artifacts\n No artifacts yet\n"),
    );
    const hdr = headerOf({
      system: [
        {
          text: "x-anthropic-billing-header: cc_version=1.a; cc_entrypoint=cli; cc_project=claude_proj_01X; cc_project_src=user;\nrest",
        },
      ],
    });
    step(
      "attribution probe: header keys and project fields, no header text kept",
      hdr.keys.join() ===
        "cc_version,cc_entrypoint,cc_project,cc_project_src" &&
        hdr.project === "claude_proj_01X" &&
        hdr.src === "user" &&
        headerOf({ system: [{ text: "plain" }] }).keys.length === 0,
    );
    step(
      "upgrade typeahead probe: the echoed input line is not a row",
      typeaheadLines("> /upg\n  /upgrade  Upgrade your plan\n", "upgrade")
        .length === 1 && typeaheadLines("> /upg\n", "upgrade").length === 0,
    );

    // pty with the live token: needs liveToken, the env file is gone after the run
    const prog = join(dir, "prog.sh");
    writeFileSync(
      prog,
      "#!/bin/sh\nprintf 'tok=[%s]\\r\\n' \"$CLAUDE_CODE_OAUTH_TOKEN\"\nsleep 1\n",
    );
    chmodSync(prog, 0o755);
    const ptyEnv = liveEnv({
      home: dir,
      configDir: dir,
      token: DRY_TOKEN,
      tty: true,
    });
    const out = join(dir, "RAW");
    const refused = await runPty({
      cwd: dir,
      env: ptyEnv,
      bin: prog,
      secs: 3,
      out,
    }).then(
      () => false,
      () => true,
    );
    const r = await runPty({
      cwd: dir,
      env: ptyEnv,
      bin: prog,
      secs: 3,
      out,
      liveToken: DRY_TOKEN,
    });
    step(
      "runPty: live token only with liveToken, env file removed",
      refused &&
        r.screen.includes(`tok=[${DRY_TOKEN}]`) &&
        !existsSync(`${out}.env.json`),
    );

    // mitm: own CA, fault replies through the proxy, everything else upstream, CA deleted on stop
    const m = await startMitm({
      tunnelOthers: false,
      upstream: async () => new Response("up", { status: 200 }),
    });
    const caFile = m.caFile;
    const get = (): Promise<Response> =>
      fetch(`https://api.anthropic.com${USAGE_PATH}`, {
        proxy: m.proxyUrl,
        tls: { ca: readFileSync(caFile) },
      } as RequestInit);
    const seen: string[] = [];
    for (const f of ["429", "429-ra", "200-envelope", "pass"] as const) {
      m.setFault(f);
      try {
        const res = await get();
        const body = await res.text();
        seen.push(
          `${res.status}${res.headers.get("retry-after") ? "+ra" : ""}${body.includes("rate_limit_error") ? "+env" : ""}`,
        );
      } catch (e) {
        seen.push(`error:${(e as Error).message.slice(0, 60)}`);
      }
    }
    const logged = JSON.stringify(m.log());
    m.stop();
    step(
      "mitm: 429 / 429+retry-after / 200 envelope / pass-through, path and status only",
      seen.join() === "429+env,429+ra+env,200+env,200" &&
        !/authorization|x-api-key|body/i.test(logged),
      seen.join(" "),
    );
    step("mitm: throw-away CA deleted on stop", !existsSync(caFile));

    // mitm hosts: a second host goes to the TLS stub under the same CA
    const mh = await startMitm({
      tunnelOthers: false,
      hosts: ["sts.us-east-1.amazonaws.com"],
      upstream: async () => new Response("sts", { status: 200 }),
    });
    const viaHost = await fetch("https://sts.us-east-1.amazonaws.com/", {
      proxy: mh.proxyUrl,
      tls: { ca: readFileSync(mh.caFile) },
    } as RequestInit)
      .then((r) => r.text())
      .catch((e: Error) => `error:${e.message.slice(0, 60)}`);
    mh.stop();
    step(
      "mitm: hosts option sends a second host to the TLS stub",
      viaHost === "sts",
      viaHost,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
