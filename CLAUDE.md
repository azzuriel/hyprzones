# CLAUDE.md

## MANDATORY WORKFLOW

- **QUESTIONS ALWAYS HAVE PRIORITY** - If the user's request contains questions, answer ALL questions FIRST before implementing anything
- **NEVER implement while questions are unanswered** - This ensures the implementation matches user intent
- **NEVER ask questions you can answer yourself** - Research first using web search, file reads, or other tools before asking the user
- **Only ask questions that require user decision** - Technical facts, versions, documentation can be researched independently
- **NEVER invent values when you have correct data** - If you researched a value (version, number, name), use EXACTLY that value, do not make up different values

## STRICTLY FORBIDDEN

- **NEVER use `sudo`** - no exceptions, no matter what
- **NO workarounds** - always implement the correct solution
- **NO hacks** - clean, correct code only
- **NO shortcuts** - complete implementations required
- **NO tricks** - use standard solutions
- **NEVER delete code to avoid implementation** - implement the code, don't remove it
- **NO stubs** - all functions must be fully implemented
- **NO TODOs** - do it right immediately
- **NO orphaned code** - all functions/methods must be used; if you implement something, use it
- **NO dead code** - remove unused code, don't leave it hanging

## FORBIDDEN COMMANDS

- **NEVER copy files to `/var/cache/hyprpm/`** - this is a system cache managed by hyprpm
- **NEVER use `hyprctl plugin load`** - the user manages plugin loading themselves
- **NEVER use `hyprpm update`** - this pulls from GitHub, not local changes
- **NEVER write to system directories** - stay within the project directory

## FORBIDDEN PHRASES IN CODE/COMMENTS

These phrases indicate incomplete work and are NOT allowed:

- "for now"
- "for the moment"
- "temporarily"
- "temp"
- "quick fix"
- "will do later"
- "later"
- "eventually"
- "at some point"
- "in the future"
- "TODO"
- "FIXME"
- "XXX"
- "HACK"
- "WIP"
- "work in progress"
- "not yet"
- "placeholder"
- "dummy"
- "mock"
- "fake"
- "stub"
- "skeleton"
- "boilerplate to be filled"
- "implement me"
- "needs implementation"
- "not implemented"
- "unimplemented"
- "pending"
- "TBD"
- "to be done"
- "to be decided"
- "figure out"
- "sort out"
- "come back to"
- "revisit"
- "refactor later"
- "clean up later"
- "good enough"
- "works for now"
- "quick and dirty"
- "simple version"
- "basic version"
- "minimal version"
- "v1"
- "first pass"
- "initial implementation"
- "rough"
- "draft"
