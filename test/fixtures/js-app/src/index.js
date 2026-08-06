const { slugify, truncate } = require("./util");

function makeHandle(name, limit) {
  return truncate(slugify(name), limit);
}

module.exports = makeHandle;
