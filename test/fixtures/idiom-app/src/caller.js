const { Dao } = require("./ctorfn");
const api = require("./objlit");

function run(db, id) {
  const dao = new Dao(db);
  return dao.getById(id) + api.getById(id);
}

module.exports = { run };
