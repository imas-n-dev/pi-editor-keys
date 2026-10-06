import { CustomEditor, copyToClipboard, type Theme } from "@earendil-works/pi-coding-agent";
import {
	decodeKittyPrintable,
	isKeyRelease,
	matchesKey,
	visibleWidth,
	type EditorTheme,
	type KeybindingsManager,
	type TUI,
} from "@earendil-works/pi-tui";
import { deleteRange, endOfText, extractRange, highlight, orderRange, type Pos, type Range } from "./range.ts";

interface LayoutLine {
	text: string;
	hasCursor: boolean;
	cursorPos?: number;
}

interface VisualLine {
	logicalLine: number;
	startCol: number;
	length: number;
}

// Pi's Editor keeps these private in its type declarations; they exist at runtime.
interface EditorInternals {
	state: { lines: string[]; cursorLine: number; cursorCol: number };
	lastAction: unknown;
	layoutText(width: number): LayoutLine[];
	buildVisualLineMap(width: number): VisualLine[];
	handlePaste(text: string): void;
	pushUndoSnapshot(): void;
	setCursorCol(col: number): void;
	exitHistoryBrowsing(): void;
	cancelAutocomplete(): void;
	expandPasteMarkers(text: string): string;
	isOnFirstVisualLine(): boolean;
	isOnLastVisualLine(): boolean;
}

const SHIFT_MOVES: [key: Parameters<typeof matchesKey>[1], sequence: string][] = [
	["shift+left", "\x1b[D"],
	["shift+right", "\x1b[C"],
	["shift+up", "\x1b[A"],
	["shift+down", "\x1b[B"],
	["shift+home", "\x1b[H"],
	["shift+end", "\x1b[F"],
	["ctrl+shift+left", "\x1b[1;5D"],
	["ctrl+shift+right", "\x1b[1;5C"],
	["alt+shift+left", "\x1b[1;5D"],
	["alt+shift+right", "\x1b[1;5C"],
];

const segmenter = new Intl.Segmenter();

function firstGraphemeLength(text: string): number {
	for (const { segment } of segmenter.segment(text)) return segment.length;
	return 1;
}

export class SelectionEditor extends CustomEditor {
	private anchor: Pos | undefined;
	private readonly internals: EditorInternals;

	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		private readonly getTheme: () => Theme,
		private readonly notifyError: (message: string) => void,
	) {
		super(tui, theme, keybindings);
		const internals = this as unknown as EditorInternals;
		this.internals = internals;

		const layoutText = internals.layoutText.bind(this);
		internals.layoutText = (width) => this.highlightLayout(layoutText(width), width);

		const handlePaste = internals.handlePaste.bind(this);
		internals.handlePaste = (text) => {
			this.deleteSelection();
			handlePaste(text);
		};
	}

	override handleInput(data: string): void {
		if (isKeyRelease(data)) return super.handleInput(data);

		const move = SHIFT_MOVES.find(([key]) => matchesKey(data, key));
		if (move) return this.extendSelection(move[0], move[1]);

		if (matchesKey(data, "ctrl+a")) {
			this.anchor = { line: 0, col: 0 };
			this.setCursor(endOfText(this.internals.state.lines));
			return;
		}

		const range = this.selection();
		if (range) {
			if (this.keybindings.matches(data, "tui.input.copy")) return this.copy(range);
			if (matchesKey(data, "ctrl+x")) {
				this.copy(range);
				this.deleteSelection();
				return;
			}
			// Bracketed paste and Ctrl+V keep the selection; handlePaste/insertTextAtCursor replace it.
			if (data.includes("\x1b[200~") || this.keybindings.matches(data, "app.clipboard.pasteImage")) {
				return super.handleInput(data);
			}
			if (
				this.keybindings.matches(data, "tui.editor.deleteCharBackward") ||
				this.keybindings.matches(data, "tui.editor.deleteCharForward") ||
				matchesKey(data, "shift+backspace") ||
				matchesKey(data, "shift+delete")
			) {
				this.deleteSelection();
				return;
			}
			if (this.keybindings.matches(data, "tui.editor.cursorLeft")) return this.collapse(range.start);
			if (this.keybindings.matches(data, "tui.editor.cursorRight")) return this.collapse(range.end);
			if (decodeKittyPrintable(data) !== undefined || !/[\x00-\x1f\x7f]/.test(data)) {
				this.deleteSelection();
			}
		}

		this.anchor = undefined;
		super.handleInput(data);
	}

	override handleMouse(event: Parameters<CustomEditor["handleMouse"]>[0]) {
		if (event.type === "click") this.anchor = undefined;
		return super.handleMouse(event);
	}

	override setText(text: string): void {
		this.anchor = undefined;
		super.setText(text);
	}

	override insertTextAtCursor(text: string): void {
		if (text) this.deleteSelection();
		super.insertTextAtCursor(text);
	}

	private selection(): Range | undefined {
		if (!this.anchor) return undefined;
		const { lines, cursorLine, cursorCol } = this.internals.state;
		return orderRange(this.anchor, { line: cursorLine, col: cursorCol }, lines);
	}

	private extendSelection(key: string, sequence: string): void {
		const { state } = this.internals;
		this.anchor ??= { line: state.cursorLine, col: state.cursorCol };
		// Plain up/down at the edges browse prompt history; select to the text edge instead.
		if (key === "shift+up" && this.internals.isOnFirstVisualLine()) return this.setCursor({ line: 0, col: 0 });
		if (key === "shift+down" && this.internals.isOnLastVisualLine()) return this.setCursor(endOfText(state.lines));
		super.handleInput(sequence);
	}

	private setCursor(pos: Pos): void {
		this.internals.state.cursorLine = pos.line;
		this.internals.setCursorCol(pos.col);
	}

	private collapse(pos: Pos): void {
		this.anchor = undefined;
		this.setCursor(pos);
	}

	private copy(range: Range): void {
		const text = this.internals.expandPasteMarkers(extractRange(this.internals.state.lines, range));
		copyToClipboard(text).catch((error: unknown) =>
			this.notifyError(error instanceof Error ? error.message : String(error)),
		);
	}

	private deleteSelection(): void {
		const range = this.selection();
		this.anchor = undefined;
		if (!range) return;
		const internals = this.internals;
		internals.cancelAutocomplete();
		internals.pushUndoSnapshot();
		internals.lastAction = null;
		internals.exitHistoryBrowsing();
		internals.state.lines = deleteRange(internals.state.lines, range);
		this.setCursor(range.start);
		this.onChange?.(this.getText());
	}

	private highlightLayout(layout: LayoutLine[], width: number): LayoutLine[] {
		const range = this.selection();
		if (!range) return layout;
		const visualLines = this.internals.buildVisualLineMap(width);
		if (visualLines.length !== layout.length) return layout;

		const { lines } = this.internals.state;
		const theme = this.getTheme();
		const style = (s: string) => theme.bg("selectedBg", s);
		const { start, end } = range;

		return layout.map((layoutLine, i) => {
			const vl = visualLines[i]!;
			const line = vl.logicalLine;
			if (line < start.line || line > end.line) return layoutLine;
			if (!(lines[line] ?? "").startsWith(layoutLine.text, vl.startCol)) return layoutLine;

			const a = (line === start.line ? start.col : 0) - vl.startCol;
			const b = (line === end.line ? end.col : Number.POSITIVE_INFINITY) - vl.startCol;
			const cursorPos = layoutLine.hasCursor ? layoutLine.cursorPos : undefined;
			const graphemeLength = cursorPos === undefined ? 1 : firstGraphemeLength(layoutLine.text.slice(cursorPos));
			const out = highlight(layoutLine.text, a, b, style, cursorPos, graphemeLength);

			// Mark the selected line break, unless the cursor already occupies that cell.
			let text = out.text;
			const endsLogicalLine = visualLines[i + 1]?.logicalLine !== line;
			const cursorAtEnd = cursorPos !== undefined && cursorPos >= layoutLine.text.length;
			if (endsLogicalLine && line < end.line && !cursorAtEnd && visibleWidth(layoutLine.text) < width) {
				text += style(" ");
			}
			return { ...layoutLine, text, cursorPos: out.cursorPos };
		});
	}
}
