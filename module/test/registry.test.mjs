// System registry contract (defineSystem and mount), without Foundry.
import assert from "node:assert/strict";
import { defineSystem, mount } from "../scripts/registry.js";

const base = () => ({ id: "x", api: 1, listedTypes: ["character"], summary: () => ({}), handlers: { foo: () => 1 } });
const throws = (f, re, msg) => assert.throws(f, re, msg);

// a valid descriptor gets defaults
const d = defineSystem(base());
assert.deepEqual(d.overrides, []); assert.deepEqual(d.ruleItemTypes, []); assert.deepEqual(d.vocab.rolls, []);
assert.ok(Object.isFrozen(d));

// invalid format
throws(() => defineSystem({ ...base(), id: "a b" }), /id is required/);
throws(() => defineSystem({ ...base(), api: 2 }), /api must be 1/);
throws(() => defineSystem({ ...base(), listedTypes: [] }), /listedTypes/);
throws(() => defineSystem({ ...base(), summary: 1 }), /summary/);
throws(() => defineSystem({ ...base(), handlers: { a: 1 } }), /handler "a"/);
throws(() => defineSystem({ ...base(), handlers: { login: () => 1 } }), /cannot be overridden/);
throws(() => defineSystem({ ...base(), modContext: "x" }), /modContext/);
throws(() => defineSystem({ ...base(), rulePacks: [{ nope: 1 }] }), /rulePacks/);
throws(() => defineSystem({ ...base(), vocab: { rolls: [1] } }), /vocab\.rolls/);

// mount: no collision
const core = { listCharacters: (u, a) => "core", getCharacter: () => "core-get" };
assert.equal(mount(core, defineSystem(base())).foo(), 1);

// a collision without overrides is an error
throws(() => mount(core, defineSystem({ ...base(), handlers: { getCharacter: () => "sys" } })), /already exists in the core/);

// declared override: the system wins and receives the core handler as 3rd argument (decorator)
const m = mount(core, defineSystem({ ...base(), overrides: ["getCharacter"], handlers: { getCharacter: (u, a, b) => `sys+${b(u, a)}` } }));
assert.equal(m.getCharacter({}, {}), "sys+core-get");
assert.equal(core.getCharacter(), "core-get", "the core map is not modified");

// override of a name that does not exist in the core is an error
throws(() => mount(core, defineSystem({ ...base(), overrides: ["naoExiste"] })), /does not exist in the core/);
console.log("ok");
