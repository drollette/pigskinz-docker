export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",     // New feature
        "fix",      // Bug fix
        "docs",     // Documentation only
        "style",    // Code style (formatting, etc)
        "refactor", // Code refactoring
        "perf",     // Performance improvement
        "test",     // Adding tests
        "build",    // Build system or dependencies
        "ci",       // CI configuration
        "chore",    // Other changes
        "revert",   // Revert a commit
      ],
    ],
    // Allow sentence-case to permit acronyms like YAML, API, URL, etc.
    "subject-case": [0],
  },
};
