"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateInventoryItem = exports.getInventoryItems = exports.createInventoryItem = void 0;
const inventoryModel_1 = require("../models/inventoryModel");
// ฟังก์ชันสำหรับเพิ่มข้อมูลสินค้าคงคลัง
const createInventoryItem = (item) => __awaiter(void 0, void 0, void 0, function* () {
    const sql = "INSERT INTO InventoryItems (date, number, amount, warehouse, supplier, bookedOn, bookedBy, sent, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
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
    const [result] = yield inventoryModel_1.pool.execute(sql, values);
    const insertId = result.insertId;
    return insertId;
});
exports.createInventoryItem = createInventoryItem;
// ฟังก์ชันสำหรับดึงข้อมูลสินค้าคงคลังทั้งหมด
const getInventoryItems = () => __awaiter(void 0, void 0, void 0, function* () {
    const sql = "SELECT * FROM InventoryItems";
    const [rows] = yield inventoryModel_1.pool.query(sql);
    return rows;
});
exports.getInventoryItems = getInventoryItems;
// ฟังก์ชันสำหรับอัปเดตข้อมูลสินค้าคงคลัง
const updateInventoryItem = (id, item) => __awaiter(void 0, void 0, void 0, function* () {
    const sql = "UPDATE InventoryItems SET date = ?, number = ?, amount = ?, warehouse = ?, supplier = ?, bookedOn = ?, bookedBy = ?, sent = ?, description = ? WHERE id = ?";
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
    yield inventoryModel_1.pool.execute(sql, values);
});
exports.updateInventoryItem = updateInventoryItem;
