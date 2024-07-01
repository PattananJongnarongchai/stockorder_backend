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

// อินเตอร์เฟซสำหรับ InventoryItem
export interface InventoryItem {
  id?: number;
  date: string;
  amount: string;
  items: number;
  warehouse: string;
  supplier: string;
  bookedOn: string;
  bookedBy: string;
  sent: boolean;
  description: string;
}
