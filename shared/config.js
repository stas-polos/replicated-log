const fs = require("fs");
const yaml = require("js-yaml");
const path = require("path");

function loadConfig() {
  try {
    const configPath = path.join(__dirname, "..", "config.yaml");
    const fileContents = fs.readFileSync(configPath, "utf8");
    return yaml.load(fileContents);
  } catch (e) {
    console.error("Error loading config:", e);
    process.exit(1);
  }
}

module.exports = { loadConfig };
