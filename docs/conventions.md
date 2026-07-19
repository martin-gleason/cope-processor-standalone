# Conventions — cope-processor-standalone

> Drop-in seed from the `cc-md` skill, vendored locally so this repo stays standalone-viable (no reach into a parent workspace that doesn't exist here).

## Work chunks (structural — the only axis with IDs)

- **Feature** `F<N>` — a deliverable unit of user value; decomposes into Tasks.
- **Task** `F<N>-T<M>` — an implementation step inside a feature.
- **Chore** `C<N>` — an operational task the human performs (parallel track to Features).
- **Retrofit** `F<N>b`, `F<N>c` — a second pass on a shipped feature.

## Lifecycle (metadata, not a container)

- **Phase** — design / build / test / deploy. A tag, not a structural ID. A feature in build phase is still `F3`, never "Phase 3."

## Authorization

- **Gate** — a boundary crossed only with explicit go-ahead. Phases and features are separated by gates.

## Merge

- **PR** — unit of change merged to `main`; addresses one or more Tasks on one feature branch.
- Branch naming: `<feature-id>/<slug>` or `<task-id>/<slug>`.
- Commit messages: `<type>(<id>): <description>` — conventional commits, ID in the type scope.
- PR titles lead with the primary ID. PR body has an `Addresses:` line enumerating tasks shipped.
- Merge strategy: **rebase-and-merge** — no squash, no merge commits. Preserves each commit for audit.

-----
July 19, 2026

#AI/Claude
