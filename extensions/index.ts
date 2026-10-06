import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SelectionEditor } from "../src/selection-editor.ts";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		ctx.ui.setEditorComponent(
			(tui, theme, keybindings) =>
				new SelectionEditor(
					tui,
					theme,
					keybindings,
					() => ctx.ui.theme,
					(message) => ctx.ui.notify(`Copy failed: ${message}`, "error"),
				),
		);
	});
}
