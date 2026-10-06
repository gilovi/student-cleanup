# student-cleanup

Vite + TypeScript browser app (no framework). Splitting logic lives in `src/vcard.ts` (pure, tested in `src/vcard.test.ts`); `src/main.ts` is the drag-and-drop UI.

- Checks: `npm run typecheck`, `npm run lint`, `npm test`.
- Naming rules are documented in README.md; change tests first when rules change.
- Never commit real contact files (they contain students' personal data).
