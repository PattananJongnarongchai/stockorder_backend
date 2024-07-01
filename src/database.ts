import { createPool, Pool } from "mysql2/promise";

// สร้างการเชื่อมต่อฐานข้อมูล
export const pool: Pool = createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "inventoryDB",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
