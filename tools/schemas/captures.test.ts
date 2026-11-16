import { expect, test } from "bun:test";

import { CAPTURES } from "./captures.ts";

const mcpAnchor = (): RegExp => {
	const capture = CAPTURES.find((c) => c.kind === "mcp");
	if (capture === undefined || !(capture.module instanceof RegExp)) {
		throw new Error("the mcp capture has no fixed anchor");
	}
	return capture.module;
};

test("mcp anchor finds the .mcp.json schema of 2.1.323", () => {
	// Arrange
	const src = `var Lk=p(()=>u({mcpServers:me(o(),pce())}));function Ui(e){return e.type==="connected"||e.type==="cached"}`;

	// Act
	const match = mcpAnchor().exec(src);

	// Assert
	expect(match?.[1]).toBe("Lk");
});

test("mcp anchor finds the .mcp.json schema when another declaration follows it, as in 2.1.326", () => {
	// Arrange
	const src = `var nv=m(()=>u({mcpServers:me(o(),nhe())})),j5a=["container_limit","no_runner_coming"];function Gi(e){return e.type==="connected"||e.type==="cached"}`;

	// Act
	const match = mcpAnchor().exec(src);

	// Assert
	expect(match?.[1]).toBe("nv");
});
