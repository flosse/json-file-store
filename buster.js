var config = module.exports;

config["server"] = {
  environment: "node",
  specs: ["spec/*.spec.coffee"],
  extensions: [require("buster-coffee")]
};
