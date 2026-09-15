## Summary

<!-- What does this change, and why? -->

## Type of change

<!-- Match the PR title prefix -- CI lints the title against these. -->

- [ ] feat -- new feature
- [ ] fix -- bug fix
- [ ] docs -- documentation only
- [ ] style -- formatting, no logic change
- [ ] refactor -- code change that isn't a fix or a feature
- [ ] perf -- performance improvement
- [ ] test -- adding/adjusting tests
- [ ] build -- build system or dependencies
- [ ] ci -- CI configuration
- [ ] chore -- other changes
- [ ] revert -- reverts a previous commit

PR title follows Conventional Commits (`type: subject`, or `type!:` for a breaking change) -- CI
rejects the title otherwise.

## Testing

- [ ] `npx tsc --noEmit` passes
- [ ] `npx next build` passes
- [ ] Manually smoke-tested the change (no automated test suite yet -- see CLAUDE.md)

## Database changes

- [ ] N/A
- [ ] Added a hand-written migration file under `drizzle/` (not `drizzle-kit generate`d -- see CLAUDE.md
      for why)

## Screenshots

<!-- If this changes anything user-visible, a before/after screenshot saves the reviewer a checkout. -->
