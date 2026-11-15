// Bridge: in the repo, the plugins (systems/<id>/module/*.js) import "../../api.js" and end up here.
// In Foundry the deploy copies each plugin to scripts/systems/<id>/, where "../../api.js" is already the core's scripts/api.js.
export * from "../module/scripts/api.js";
