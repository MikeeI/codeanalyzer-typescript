// Fixture data, not a real test: named `.test.js` only so discovery's skip-tests classifier
// has something to classify. Deliberately contains no test-runner calls so that `bun test`
// does not execute fixture files as part of the analyzer's own suite.
const { slugify } = require("./util");

function expectedHandle(name) {
  return slugify(name);
}

module.exports = { expectedHandle };
