function Dao(db) {
  const helper = () => "h";

  this.getById = (id) => {
    return helper() + db.collection("x").find(id);
  };

  this.save = function (row) {
    return db.collection("x").insert(row);
  };
}

module.exports = { Dao };
