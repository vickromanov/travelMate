# Skills

Project-scoped **Agent Skills** for TravelMate. They're committed to the repo, so every
teammate — and any Claude session opened in this project — can use them.

## Layout

Each skill is a folder containing a `SKILL.md`:

```
.claude/skills/
└── <skill-name>/
    └── SKILL.md     # YAML frontmatter (name + description) then markdown instructions
    └── ...          # optional supporting files the skill references
```

## SKILL.md shape

```markdown
---
name: <skill-name>
description: <one or two sentences — WHEN to use this skill. This is what determines
             whether the skill triggers, so be specific and include trigger words.>
---

# <Skill title>

Step-by-step instructions / checklists / examples for the task.
```

## Guidelines

- The `description` is the trigger — make it concrete (mention the files, tiers, or
  actions involved), not vague.
- Keep skills focused on one workflow; compose rather than building one mega-skill.
- Skills should respect the architecture in `projectStructure.md` (tier boundaries,
  contracts-first, etc.).
