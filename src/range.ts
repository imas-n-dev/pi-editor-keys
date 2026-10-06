export interface Pos {
	line: number;
	col: number;
}

export interface Range {
	start: Pos;
	end: Pos;
}

export function comparePos(a: Pos, b: Pos): number {
	return a.line - b.line || a.col - b.col;
}

/** Ordered, non-empty range between anchor and cursor, or undefined. */
export function orderRange(anchor: Pos, cursor: Pos, lines: string[]): Range | undefined {
	if (anchor.line >= lines.length || anchor.col > (lines[anchor.line] ?? "").length) return undefined;
	const cmp = comparePos(anchor, cursor);
	if (cmp === 0) return undefined;
	return cmp < 0 ? { start: anchor, end: cursor } : { start: cursor, end: anchor };
}

export function extractRange(lines: string[], { start, end }: Range): string {
	if (start.line === end.line) return lines[start.line]!.slice(start.col, end.col);
	return [
		lines[start.line]!.slice(start.col),
		...lines.slice(start.line + 1, end.line),
		lines[end.line]!.slice(0, end.col),
	].join("\n");
}

export function deleteRange(lines: string[], { start, end }: Range): string[] {
	return [
		...lines.slice(0, start.line),
		lines[start.line]!.slice(0, start.col) + lines[end.line]!.slice(end.col),
		...lines.slice(end.line + 1),
	];
}

export function endOfText(lines: string[]): Pos {
	const line = lines.length - 1;
	return { line, col: (lines[line] ?? "").length };
}

/**
 * Highlight [a, b) of one visual line's text with `style`.
 * `cursorPos` is the editor's fake-cursor index in `text`; the returned index points
 * at the same grapheme in the styled text, and the cursor grapheme is left unstyled
 * so Pi's own cursor rendering stays intact.
 */
export function highlight(
	text: string,
	a: number,
	b: number,
	style: (s: string) => string,
	cursorPos?: number,
	cursorGraphemeLength = 1,
): { text: string; cursorPos?: number } {
	a = Math.max(0, Math.min(a, text.length));
	b = Math.max(a, Math.min(b, text.length));
	const s = (t: string) => (t ? style(t) : "");
	if (a === b) return { text, cursorPos };
	if (cursorPos === undefined) {
		return { text: text.slice(0, a) + s(text.slice(a, b)) + text.slice(b) };
	}
	if (cursorPos >= a && cursorPos < b) {
		const before = text.slice(0, a) + s(text.slice(a, cursorPos));
		const g = cursorPos + cursorGraphemeLength;
		return {
			text: before + text.slice(cursorPos, g) + s(text.slice(g, b)) + text.slice(b),
			cursorPos: before.length,
		};
	}
	const styled = text.slice(0, a) + s(text.slice(a, b)) + text.slice(b);
	return { text: styled, cursorPos: cursorPos < a ? cursorPos : cursorPos + styled.length - text.length };
}
