import { Badge as MantineBadge, Tooltip, VisuallyHidden } from "@mantine/core";
import type React from "react";

type Kind =
	| "documented"
	| "undocumented"
	| "differs"
	| "gated"
	| "managed-only"
	| "experimental"
	| "deprecated"
	| "caution";

const META: Record<Kind, { label: string; tip: string }> = {
	documented: {
		label: "Documented",
		tip: "An official docs page names this item.",
	},
	undocumented: {
		label: "Undocumented",
		tip: "Only the program shows this item. It can change without notice.",
	},
	differs: {
		label: "Differs",
		tip: "The official docs and the program disagree. The row says how.",
	},
	gated: { label: "Gated", tip: "Works only behind a flag or a server gate." },
	"managed-only": {
		label: "Managed Only",
		tip: "Works only in managed (organization policy) settings.",
	},
	experimental: {
		label: "Experimental",
		tip: "The program or the official docs call this experimental or beta.",
	},
	deprecated: {
		label: "Deprecated",
		tip: "The program or the official docs call this deprecated.",
	},
	caution: {
		label: "Caution",
		tip: "It deletes data, skips a safety check, or sends data off your machine.",
	},
};

// Label badges are outlined. The others have no border.
const OUTLINED = new Set<Kind>([
	"managed-only",
	"experimental",
	"deprecated",
	"caution",
]);

interface Props {
	note?: string;
}

type VarStyle = React.CSSProperties & Record<`--${string}`, string>;

const Badge = ({ kind, note }: Props & { kind: Kind }): React.JSX.Element => {
	const { label, tip } = META[kind];
	const text = note === undefined || note === "" ? tip : `${tip} ${note}`;
	// The color variables switch with the theme in custom.css.
	const style: VarStyle = {
		"--badge-bg": `var(--cc-badge-${kind}-bg)`,
		"--badge-color": `var(--cc-badge-${kind}-fg)`,
		"--badge-bd": OUTLINED.has(kind)
			? "1px solid currentColor"
			: "1px solid transparent",
	};
	return (
		<Tooltip
			label={text}
			multiline
			maw={320}
			withArrow
			events={{ hover: true, focus: true, touch: true }}
		>
			<MantineBadge
				// The tip must show on keyboard focus, so the badge takes focus.
				tabIndex={0}
				className={`cc-badge cc-badge--${kind}`}
				style={style}
				radius={3}
				tt="none"
				leftSection={<span aria-hidden="true" className="cc-badge__glyph" />}
			>
				{label}
				{/* A Mantine tooltip shows on hover only, so a screen reader reads the tip here. */}
				<VisuallyHidden>{`: ${text}`}</VisuallyHidden>
			</MantineBadge>
		</Tooltip>
	);
};

export const Documented = (p: Props) => <Badge kind="documented" {...p} />;
export const Undocumented = (p: Props) => <Badge kind="undocumented" {...p} />;
export const Differs = (p: Props) => <Badge kind="differs" {...p} />;
export const Gated = (p: Props) => <Badge kind="gated" {...p} />;
export const ManagedOnly = (p: Props) => <Badge kind="managed-only" {...p} />;
export const Experimental = (p: Props) => <Badge kind="experimental" {...p} />;
export const Deprecated = (p: Props) => <Badge kind="deprecated" {...p} />;
export const Caution = (p: Props) => <Badge kind="caution" {...p} />;
