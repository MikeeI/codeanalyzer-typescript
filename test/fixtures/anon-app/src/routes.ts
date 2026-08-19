export function login() {
  return (req: any, res: any) => {
    const email = req.body.email;
    query(`SELECT * FROM Users WHERE email = '${email}'`);
  };
}

export function query(sql: string) {
  return sql;
}

const app: any = {};
app.get("/health", (req: any, res: any) => {
  res.send(req.query.probe);
});

const named = () => 1;

export function outer() {
  return () => () => named();
}
