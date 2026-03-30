# CLAUDE.md

## Coding 

### Releases

When you are instructed to "update the version", "bump version" or "create a release" you should update the version in package.json to recommended version according to semver logic of what was changed. Then write into CHANGELOG.md a summary of what was changed.

### Testing
- Always **make a test first** for a feature or change that is being requested. Define it by writing tests first and requesting details on its behavior from the developer. If the behavior is trivial, you can just write the tests. After that, implement the code that can pass the test.
- Always make tests for specific behaviors that are being requested.
- Always make tests for change requests. 
- You are never allowed to change tests to accommodate code changes. You must **always** stop and notify and consult with the developer if a new feature is breaking an existing tests. You are only allowed to add new tests automatically based on requested functionality. You are not allowed to remove or modify tests when making code changes.

## Repository
- Never force push git

## Writing Rules

These rules apply to all produced material: docs, comments, UI copy, and any text written.

- **Specific words over general ones.** Not "move": "shuffle." Not "say": "announce." Not "problem": "bottleneck." The right word does more than the right sentence. Before settling on a word, ask: is there a more precise one?
- **No em dash.** Use a colon, comma, or period instead. Em dashes read as AI-generated filler.
- **No hollow intensifiers.** Cut "very", "really", "quite", "essentially", "basically". If the word needs a modifier to do its job, find a better word.
- **Active voice by default.** "We built X" not "X was built." Passive is allowed when the actor is unknown or irrelevant.
- **Short sentences carry more weight than long ones.** When a sentence has more than two clauses, split it.
- **No throat-clearing.** Never open with "In today's world", "As we all know", or any sentence that delays the point.

## Documentation

- Do NOT hardcode dynamic content that can drift. Never enumerate plugins, skills, dependencies, components, or any other list that has a file or folder as its source of truth. Instead, refer to that source directly. For example: `package.json` rather than listing dependencies.
- Do NOT hardcode dynamic content that can drift (module lists, dependency lists, component inventories). Reference the source files or directories instead.
