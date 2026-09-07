(function (root) {
  "use strict";
  var entries = [
    {id:"hills", name:"The Hills", theme:"alpine", light:"day"},
    {id:"waterfalls", name:"The Falls", theme:"forest", light:"dusk"},
    {id:"moon-rome", name:"Moonlit Rome", theme:"roman", light:"night"},
    {id:"snow", name:"The Snow", theme:"snow", light:"overcast"},
    {id:"sunset-rome", name:"Sunset Rome", theme:"roman", light:"sunset"},
    {id:"blossom", name:"The Blossom", theme:"cherry", light:"pink-sunset"}
  ].map(function (entry) { return Object.freeze(entry); });
  Object.freeze(entries);
  function find(id) {
    return entries.find(function (entry) { return entry.id === id; }) || null;
  }
  function key(id, record) {
    if (!find(id)) throw new Error("Unknown realm: " + id);
    if (["best", "journey", "milestones", "ghost"].indexOf(record) < 0) throw new Error("Unknown realm record: " + record);
    return "sisyphus6.realm." + id + "." + record;
  }
  function newClimb(id) {
    if (!find(id)) throw new Error("Unknown realm: " + id);
    // A realm identifies the scenery, never an offset in the player's score.
    return {version:1, realm:id, altitude:0, peak:0, roll:0, gait:0, energy:1, resolve:0, snow:0, elapsed:0};
  }
  function acceptsSave(id, saved) {
    return !!find(id) && !!saved && saved.version === 1 && saved.realm === id;
  }
  var api = Object.freeze({entries:entries, find:find, key:key, newClimb:newClimb, acceptsSave:acceptsSave});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SisyphusRealms = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
