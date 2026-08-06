function Dao2(this: any, db: any) {
  this.getById = (id: number) => {
    return db.collection("x").find(id);
  };
}

export { Dao2 };
