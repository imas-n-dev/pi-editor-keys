import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteRange, extractRange, highlight, orderRange } from "../src/range.ts";

const lines = ["hello world", "second", "third line"];
const S = (s: string) => `[${s}]`;

test("orderRange orders and rejects empty or stale anchors", () => {
	assert.deepEqual(orderRange({ line: 1, col: 3 }, { line: 0, col: 2 }, lines), {
		start: { line: 0, col: 2 },
		end: { line: 1, col: 3 },
	});
	assert.equal(orderRange({ line: 0, col: 1 }, { line: 0, col: 1 }, lines), undefined);
	assert.equal(orderRange({ line: 5, col: 0 }, { line: 0, col: 0 }, lines), undefined);
	assert.equal(orderRange({ line: 1, col: 99 }, { line: 0, col: 0 }, lines), undefined);
});

test("extractRange single and multi line", () => {
	assert.equal(extractRange(lines, { start: { line: 0, col: 6 }, end: { line: 0, col: 11 } }), "world");
	assert.equal(extractRange(lines, { start: { line: 0, col: 6 }, end: { line: 2, col: 5 } }), "world\nsecond\nthird");
});

test("deleteRange joins the boundary lines", () => {
	assert.deepEqual(deleteRange(lines, { start: { line: 0, col: 5 }, end: { line: 2, col: 5 } }), ["hello line"]);
	assert.deepEqual(deleteRange(lines, { start: { line: 1, col: 0 }, end: { line: 1, col: 6 } }), [
		"hello world",
		"",
		"third line",
	]);
});

test("highlight without cursor", () => {
	assert.deepEqual(highlight("abcdef", 1, 3, S), { text: "a[bc]def" });
	assert.deepEqual(highlight("abc", -4, 99, S), { text: "[abc]" });
	assert.deepEqual(highlight("abc", 2, 2, S), { text: "abc", cursorPos: undefined });
});

test("highlight keeps the cursor grapheme unstyled and indexes it", () => {
	// Cursor right after the selection.
	let out = highlight("abcdef", 1, 3, S, 3);
	assert.equal(out.text, "a[bc]def");
	assert.equal(out.text.slice(out.cursorPos), "def");

	// Cursor at the selection start.
	out = highlight("abcdef", 1, 3, S, 1);
	assert.equal(out.text, "ab[c]def");
	assert.equal(out.text.slice(out.cursorPos), "b[c]def");

	// Cursor before the selection.
	out = highlight("abcdef", 3, 5, S, 0);
	assert.equal(out.cursorPos, 0);

	// Cursor at the end of the line.
	out = highlight("abc", 0, 3, S, 3);
	assert.equal(out.text, "[abc]");
	assert.equal(out.cursorPos, out.text.length);
});
