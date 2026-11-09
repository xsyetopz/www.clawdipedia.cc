import Link from "@docusaurus/Link";
import { Anchor, Box, Group, Stack, Text, Title } from "@mantine/core";
import {
	Differs,
	Documented,
	Gated,
	Undocumented,
} from "@site/src/components/badge";
import { CLAUDE_CODE_VERSION } from "@site/src/version";
import type React from "react";

const KEY: { badge: React.JSX.Element; text: string }[] = [
	{ badge: <Documented />, text: "An official docs page names it." },
	{
		badge: <Undocumented />,
		text: "Only the program shows it. It can change without notice.",
	},
	{
		badge: <Differs />,
		text: "The docs and the program disagree. The row says how.",
	},
	{ badge: <Gated />, text: "It works only behind a flag or a server gate." },
];

const KeyList = (): React.JSX.Element => (
	<Stack component="ul" gap="0.6rem" my="1.5rem" p={0}>
		{KEY.map(({ badge, text }) => (
			<Group
				component="li"
				key={text}
				gap="0.75rem"
				wrap="wrap"
				style={{ listStyle: "none" }}
			>
				<Box w={{ base: "auto", xs: "9.5rem" }}>{badge}</Box>
				<Text span>{text}</Text>
			</Group>
		))}
	</Stack>
);

const Links = (): React.JSX.Element => (
	<Group gap="1.5rem" style={{ fontFamily: "var(--ifm-heading-font-family)" }}>
		<Anchor
			component={Link}
			to="/start/how-to-read"
			fw={600}
			c="var(--ifm-link-color)"
		>
			Start with How to Read These Docs
		</Anchor>
		<Anchor
			component={Link}
			to="/reference/undocumented"
			fw={600}
			c="var(--ifm-link-color)"
		>
			See What the Docs Leave Out
		</Anchor>
	</Group>
);

export const Hero = (): React.JSX.Element => (
	<Box component="header" mb="2.5rem">
		<Title
			order={1}
			maw="20ch"
			style={{
				fontSize: "clamp(2.2rem, 5vw, 3.2rem)",
				fontWeight: 700,
				lineHeight: 1.15,
			}}
		>
			Every Part of Claude Code You Can Use or Change
		</Title>
		<Text maw="60ch" fz="1.1rem" lh="var(--ifm-line-height-base)">
			Unofficial community docs for version <code>{CLAUDE_CODE_VERSION}</code>,
			built from the official docs and the program itself. Not made by or tied
			to Anthropic. For supported behavior, check the official docs first.
		</Text>
		<KeyList />
		<Links />
	</Box>
);
