// The npm packages that bundled libraries of the program come from, by the reason of an exclusion.
const AWS = [
	"@aws-sdk/",
	"@smithy/",
	"@aws-crypto/",
	"@aws-sdk/credential-providers",
];
const GOOGLE = ["google-auth-library", "gaxios", "gcp-metadata"];
const OTEL = [
	"@opentelemetry/api",
	"@opentelemetry/core",
	"@opentelemetry/resources",
	"@opentelemetry/sdk-trace-base",
	"@opentelemetry/sdk-metrics",
	"@opentelemetry/sdk-logs",
	"@opentelemetry/otlp-exporter-base",
	"@opentelemetry/otlp-transformer",
	"@opentelemetry/exporter-trace-otlp-http",
];
/** Reason of an entry to the npm packages whose published source must hold its text. A name ending in `/` is every bundled package of that scope. */
export const LIBS: [RegExp, string[]][] = [
	[/AWS SDK and Smithy/u, AWS],
	[/jose/u, ["jose"]],
	[/Google auth library|google-auth-library/u, GOOGLE],
	[/Zod/u, ["zod"]],
	[/helper library/u, ["turndown", "@mixmark-io/domino"]],
	[
		/MCP SDK v2/u,
		["@modelcontextprotocol/client", "@modelcontextprotocol/server"],
	],
	[/MCP SDK/u, ["@modelcontextprotocol/sdk"]],
	[/gRPC/u, ["@grpc/grpc-js", "@grpc/proto-loader"]],
	[/protobuf and CEL/u, ["@bufbuild/protobuf", "@bufbuild/cel"]],
	[
		/Azure SDK|Azure identity/u,
		[
			"@azure/identity",
			"@azure/core-rest-pipeline",
			"@azure/core-client",
			"@azure/core-tracing",
			"@azure/msal-node",
			"@azure/msal-common",
		],
	],
	[/Standard Webhooks/u, ["standardwebhooks"]],
	[/bundled Agent SDK/u, ["@anthropic-ai/claude-agent-sdk"]],
	[/Vertex client/u, ["@anthropic-ai/vertex-sdk"]],
	[/embedded Anthropic SDK client/u, ["@anthropic-ai/sdk"]],
	[/Anthropic SDK/u, ["@anthropic-ai/sdk"]],
	[
		/Anthropic cloud-provider SDKs/u,
		[
			"@anthropic-ai/bedrock-sdk",
			"@anthropic-ai/vertex-sdk",
			"@anthropic-ai/foundry-sdk",
			"@anthropic-ai/aws-sdk",
		],
	],
	[/Ajv/u, ["ajv", "ajv-formats"]],
	[/pngjs/u, ["pngjs"]],
	[/QR code/u, ["qrcode"]],
	[/lodash/u, ["lodash"]],
	[/base64-js/u, ["base64-js"]],
	[/OpenTelemetry SDK/u, OTEL],
	[/p-map and OpenTelemetry exporter/u, ["p-map", ...OTEL]],
	[/vscode-jsonrpc/u, ["vscode-jsonrpc"]],
	[/execa/u, ["execa"]],
	[/commander/u, ["commander"]],
	[/lru-cache/u, ["lru-cache"]],
	[/undici/u, ["undici"]],
	[/tslib/u, ["tslib"]],
	[/GrowthBook/u, ["@growthbook/growthbook"]],
	[/diff library/u, ["diff"]],
	[/Ink and ow/u, ["ink", "ow"]],
	[/jsonc-parser/u, ["jsonc-parser"]],
	[/chokidar/u, ["chokidar", "readdirp", "anymatch"]],
	[/Markdown extension registration/u, ["marked"]],
	[/path of the bundled AWS SDK/u, AWS],
	[/bundled Google auth library/u, GOOGLE],
	[/bundled cloud SDK/u, [...AWS, ...GOOGLE]],
	[
		/HTTP proxy-agent library/u,
		[
			"agent-base",
			"http-proxy-agent",
			"https-proxy-agent",
			"socks-proxy-agent",
			"socks",
		],
	],
];

/** A reason that starts "Bundled <package>" names the package: its first word when that is a package name, else the first scoped name in the reason. */
export const bundledName = (reason: string): string[] | undefined => {
	const word = /^Bundled (@[\w.-]+\/[\w.-]+|[a-z][\w.-]*)/u.exec(reason)?.[1];
	const scoped = /^Bundled .*?(@[\w.-]+\/[\w.-]+)/u.exec(reason)?.[1];
	const name = word ?? scoped;
	return name === undefined || name === "" ? undefined : [name];
};
