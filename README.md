# pi-editor-keys

Desktop-style selection and clipboard keys for the [Pi](https://pi.dev) prompt editor.

| Keys | Action |
| --- | --- |
| Shift+Left/Right/Up/Down | Extend the selection |
| Shift+Home / Shift+End | Select to line start / end |
| Ctrl+Shift+Left/Right | Select by word |
| Ctrl+A | Select all (replaces Pi's Ctrl+A = line start; Home still works) |
| Ctrl+C | Copy the selection |
| Ctrl+X | Cut the selection |
| Ctrl+V, terminal paste | Replace the selection with the clipboard |
| Typing, Backspace, Delete | Replace / delete the selection |
| Left / Right | Collapse the selection to its start / end |

Without a selection, Ctrl+C, Ctrl+X and Ctrl+V keep Pi's default behaviour (clear/exit, copy message, paste). Shift+Up on the first line selects to the start of the prompt instead of browsing history; Shift+Down on the last line selects to the end.

## Install

```sh
pi install npm:pi-editor-keys
```

Try a local checkout for one session:

```sh
pi -e ./pi-editor-keys
```

## Clipboard

Copy uses Pi's clipboard helper: `wl-copy` on Wayland, `xclip`/`xsel` on X11, `pbcopy` on macOS, and OSC 52 over SSH or without a display. Copy failures are shown as an error in Pi.

## Terminal multiplexers

Inside [herdr](https://herdr.dev), tmux, and similar tools:

- Only the multiplexer's prefix key is captured (herdr and tmux default to Ctrl+B, which Pi also uses for cursor-left).
- Mouse drag selection belongs to the multiplexer; keyboard selection from this package still works.
- Panes inherit the multiplexer server's environment. If the server was started without `WAYLAND_DISPLAY`/`DISPLAY`, Pi falls back to OSC 52, which the multiplexer must forward to the outer terminal.

## Compatibility

Pi allows one custom editor at a time, so this package conflicts with other packages that replace the editor (for example vim-mode editors).

It extends Pi's `CustomEditor` and uses some editor internals that are private in Pi's type declarations. A Pi update that changes those internals can break it; the package is tested against Pi 1.0.4.

## Development

```sh
npm test
```

## License

MIT
