import { pool } from "../models/inventoryModel";
import { InventoryItem } from "../types";

// ฟังก์ชันสำหรับเพิ่มข้อมูลสินค้าคงคลัง
export const createInventoryItem = async (
  item: InventoryItem
): Promise<number> => {
  const sql =
    "INSERT INTO InventoryItems (date, number, amount, warehouse, supplier, bookedOn, bookedBy, sent, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
  const values = [
    item.date,
    item.number,
    item.amount,
    item.warehouse,
    item.supplier,
    item.bookedOn,
    item.bookedBy,
    item.sent,
    item.description,
  ];

  const [result] = await pool.execute(sql, values);
  const insertId = (result as any).insertId;
  return insertId;
};

// ฟังก์ชันสำหรับดึงข้อมูลสินค้าคงคลังทั้งหมด
export const getInventoryItems = async (): Promise<InventoryItem[]> => {
  const sql = "SELECT * FROM InventoryItems";
  const [rows] = await pool.query(sql);
  return rows as InventoryItem[];
};

// ฟังก์ชันสำหรับอัปเดตข้อมูลสินค้าคงคลัง
export const updateInventoryItem = async (
  id: number,
  item: InventoryItem
): Promise<void> => {
  const sql =
    "UPDATE InventoryItems SET date = ?, number = ?, amount = ?, warehouse = ?, supplier = ?, bookedOn = ?, bookedBy = ?, sent = ?, description = ? WHERE id = ?";
  const values = [
    item.date,
    item.number,
    item.amount,
    item.warehouse,
    item.supplier,
    item.bookedOn,
    item.bookedBy,
    item.sent,
    item.description,
    id,
  ];

  await pool.execute(sql, values);
};
