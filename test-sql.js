const initSqlJs = require("sql.js");

async function runTest() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE test (id int, name text);");
  db.run("INSERT INTO test VALUES (?, ?)", [1, "foo"]);
  
  try {
    const res = db.exec("SELECT * FROM test WHERE name = ?", ["foo"]);
    console.log("EXEC SUCCESS:", JSON.stringify(res));
  } catch (e) {
    console.log("EXEC ERROR:", e.message);
  }
}

runTest();
