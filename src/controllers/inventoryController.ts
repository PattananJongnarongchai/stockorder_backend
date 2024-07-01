import { Request, Response } from "express";
import {
  createInventoryItem,
  getInventoryItems,
  updateInventoryItem,
} from "../services/inventoryService";
import { InventoryItem } from "../types";

// ฟังก์ชันสำหรับเพิ่มข้อมูลสินค้าคงคลัง
export const addInventoryItem = async (req: Request, res: Response) => {
  try {
    const item: InventoryItem = req.body;
    const insertId = await createInventoryItem(item);
    res.status(201).send({ id: insertId, ...item });
  } catch (error) {
    res.status(500).send(`Error inserting data: ${error}`);
  }
};

// ฟังก์ชันสำหรับดึงข้อมูลสินค้าคงคลังทั้งหมด
export const getAllInventoryItems = async (req: Request, res: Response) => {
  try {
    const items = await getInventoryItems();
    res.status(200).send(items);
  } catch (error) {
    res.status(500).send(`Error fetching data: ${error}`);
  }
};

// ฟังก์ชันสำหรับอัปเดตข้อมูลสินค้าคงคลัง
export const editInventoryItem = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const item: InventoryItem = req.body;
    await updateInventoryItem(id, item);
    res.status(200).send({ id, ...item });
  } catch (error) {
    res.status(500).send(`Error updating data: ${error}`);
  }
};
