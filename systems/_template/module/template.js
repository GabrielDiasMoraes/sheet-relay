// Example system commands. Each command receives (user, args): `user` is the session's Foundry user and `args` the call body.
// Rules: never name an argument `id`, `type` or `token` (the relay strips them); use ownedActor to check who may touch the actor.
import { fail, ownedActor, pick, text } from "../../api.js";

export const LISTED = ["character"]; // actor types that appear in the app
export const summary = (a) => ({ id: a.id, name: a.name, type: a.type, hp: a.system.attributes?.hp ?? null });

const sheet = (a) => ({ ...summary(a), img: a.img, biography: text(a.system.details?.biography?.value ?? a.system.biography ?? "") });

export const handlers = {
  getCharacter: (user, { actorId, tokenId }) => sheet(ownedActor(user, actorId, tokenId)),

  // Only what the app may change goes here (fixed list): the relay is a GM user, so validate everything.
  async update(user, { actorId, name }) {
    const a = ownedActor(user, actorId);
    if (typeof name !== "string" || !name.trim() || name.length > 60) throw fail(400, "invalid name");
    await a.update({ name: name.trim() }, { sheetRelayUser: user.id });
    return sheet(a);
  },

  // Rolls a formula in the Foundry chat. Limit what the app can ask for.
  async roll(user, { actorId, formula = "1d20", bonus = 0 }) {
    const a = ownedActor(user, actorId);
    bonus = pick(bonus, 0, -20, 20, "bonus");
    if (typeof formula !== "string" || formula.length > 30 || !Roll.validate(formula)) throw fail(400, "invalid formula");
    const r = await new Roll(`${formula} + ${bonus}`, a.getRollData()).evaluate();
    await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: a }), flavor: "App roll" });
    return { formula: r.formula, total: r.total, dice: r.dice.flatMap((d) => d.results.map((x) => x.result)) };
  }
};
