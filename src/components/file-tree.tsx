import { List, Paper } from "@mantine/core";
import React from "react";

interface ElementProps {
	children?: React.ReactNode;
	className?: string;
}

const typeName = (type: unknown): string =>
	typeof type === "function" ? type.name : "";

const isList = (type: unknown): boolean =>
	type === "ul" || /^MDXUl$|^Ul$/iu.test(typeName(type));

const isItem = (type: unknown): boolean =>
	type === "li" || /^MDXLi$|^Li$/iu.test(typeName(type));

// Rebuilds the MDX list on Mantine List. It also marks every inline code item
// that ends in "/" as a folder, so CSS can set folders apart without color.
const mark = (node: React.ReactNode): React.ReactNode =>
	React.Children.map(node, (child) => {
		if (!React.isValidElement<ElementProps>(child)) {
			return child;
		}
		const { children, className } = child.props;
		if (isList(child.type)) {
			// list-style: none makes VoiceOver drop the list role, so restore it.
			return (
				<List type="unordered" listStyleType="none" role="list">
					{mark(children)}
				</List>
			);
		}
		if (isItem(child.type)) {
			return <List.Item>{mark(children)}</List.Item>;
		}
		if (typeof children === "string") {
			return children.endsWith("/")
				? React.cloneElement(child, {
						className: `${className ?? ""} cc-folder`.trim(),
					})
				: child;
		}
		return children === undefined
			? child
			: React.cloneElement(child, {}, mark(children));
	});

export const FileTree = ({
	children,
}: {
	children?: React.ReactNode;
}): React.JSX.Element => (
	<Paper className="cc-filetree" component="div" withBorder={false}>
		{mark(children)}
	</Paper>
);
