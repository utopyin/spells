This repo is a collections of packagable internal utility apps. It is fully Effect v4 based, and uses Alchemy for IaC.
A `Spell` is a packaged app contained in its own Alchemy `Stack`. They live in `./spells/*` and have their own deploy lifecycle.
The main web app that lives in `./app/web` in the single entry point for headless spells (no frontend deployment) where end user can configure Spells.
Shared packages useful across stacks live in `./packages/*`

Spells can talk to each others using Alchemy patterns.

The current spells are

- Identity (shared auth layer)
- Kadoki (syncs Linear with Google Calendar)

# Principles

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.
- If changes appear after your own changes, assume they are most likely human changes. Do not revert or overwrite them. If you think they may be wrong or accidental, ask the human before changing them.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

## Vendored Repositories

This project vendors external repositories under `@repos/`

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under `@repos/`
- Do not import from `@repos/` - application code should continue importing from normal package dependencies

When writing Effect code, inspect `@repos/effect/`.
When writing Alchemy (Infrastructure as Code), inspect `@repos/alchemy/`.
When writing Drizzle code, inspect `@repos/drizzle/`. We are using the latest Drizzle version with breaking changes.

Use `@repos/` for examples of idiomatic usage, tests, module structure, and API design. Treat it as the source of truth for Effect patterns.
