# Roll modifier scan

Goal: given a group of perks/feats/features, find the ones that **alter a roll** and describe each as a structured rule. Do not write anything to Foundry; only read (MCP) and write the output JSON.

## Output
`content/roll-mods/<system>_<n>.json`: object `{ "<item name in English>": { "uuid": "...", "regras": [ rule, ... ] }, ... }` only with items that affect a roll. At the end, in the same file, key `"_resumo"`: `{ "analisados": N, "com_regra": M, "duvidosos": ["name: reason"], "efeitos_novos": ["effect types the schema does not cover"] }`.
Items with no effect on a roll (text only, defensive, narrative) are left out, but count in `analisados`.

## Rule
`{ "id": "slug", "label": "short pt-BR", "text": "one pt-BR sentence of the effect", "when": {...filter...}, "effects": [...], "cost": {...}, "auto": "condition the system could detect (optional)" }`
- `when`: `rolls` (types: skill, check, save, attack, damage, initiative, spell, heal, soak...), `skills`, `attributes`, `item` (`weaponType`, `tags`, `damageType`, `range`), `situation` (free text when it depends on the scene).
- `effects` (combine): `{set:"attribute|skill|rank|tag", value}`, `{add:"result|tn|damage|difficulty", formula}`, `{mode:"adv|dis"}`, `{dice:+N}` (extra dice), `{complication:-N}`, `{extraRoll:{label,formula}}`, `{reroll:...}`, `{autoCrit:true}`, `{quality:{name,value}}` (Fallout damage effect: Piercing X etc.), `{replace:"..."}`. If none fits, use `{other:"description"}` and list it in `efeitos_novos`.
- Formulas: `@rank`, `@str`..., `@prof`, `@level` etc.
- `cost`: `{uses:{max,per:"scene|sr|lr|day|turn"}, ap:N, luck:N, resource:"description"}`.
- Stay faithful to the text; do not invent; if the text is ambiguous put it in `duvidosos`.
- Perks with several ranks: one `effects` with a formula in `@rank` or one rule per rank.
- The `label`/`text` fields are in pt-BR; attribute/skill names use the system's key.

## Fallout system (2d20)
Base 2d20 (target = attribute + skill rank; TAG makes 20 and below count as 2 successes... check the text). Extra dice: 3d20 up to 6d20, bought with **AP** (group pool, max 6) or **Luck** (per character). Complication 20 (or more with a complication range). Combat damage in d6, with effects (Piercing X, Vicious, etc.) and qualities. Each perk says whether it costs AP/Luck/a use. Rules apply to every character with the perk.

## D&D 5.5e (2024) system
D20 tests (advantage/disadvantage, bonuses, bonus die such as 1d4/Inspiration), attacks, damage, saving throws, initiative, death saves. Set `cost.uses` according to the resource (Short/Long Rest, Proficiency Bonus times, etc.). Ignore: creatures, spells (they are activated, they do not alter other rolls); only features that alter a roll are included.

## Avatar Legends system (2d6)
Roll 2d6 + stat (Creativity, Focus, Harmony, Passion) + bonus/penalty; 10+ full success, 7-9 partial, 6- miss. What alters the roll: +1/-1 forward or ongoing, changing the stat used, a bonus for a marked condition, rolling with advantage (2 dice, best), treating the result as 10+, adjusting the result, marking/clearing a condition or fatigue as a cost, Balance/Principles. Playbook moves and Techniques only count when they alter a roll (the owner's or someone else's). Each item carries `system.approach`, `training`, etc.; read the description. Use `rolls` such as: move, technique, balance, principle, resist, status...
