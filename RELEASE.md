# Releasing pi-editor-keys

Pushing a `v*` tag publishes to npm through GitHub Actions
(`.github/workflows/publish.yml`, using npm trusted publishing). No npm token is needed.

## Release

From the repo root:

```sh
git pull
npm test
pi -e .                    # try the keys by hand, standalone and in a terminal multiplexer
npm version patch          # or minor / major: bumps package.json, commits, tags vX.Y.Z
git push --follow-tags     # the tag push triggers the publish
gh run watch               # follow the Publish run
npm view pi-editor-keys version   # can take a few minutes to show up
```

Which version: `patch` for fixes, `minor` for new keys or features, `major` for breaking changes.

## If the publish fails

- Check the log with `gh run view --log-failed`.
- Fix it, then `npm version patch` again. Don't move or reuse an existing tag: npm never accepts the same version twice.
- To re-run without code changes, use `gh run rerun <id>`. That only works if the version isn't on npm yet.

## After a Pi update

The editor uses Pi internals (see README › Compatibility). Re-test with `pi -e .`, then update
the "tested against Pi x.y.z" line in the README and release.
