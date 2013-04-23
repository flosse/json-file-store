var config = module.exports;

config["server"] = {
  env: "node",
  specs: ["spec/*.spec.coffee"],
  extensions: [require("buster-coffee")]
};
