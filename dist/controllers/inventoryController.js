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
exports.editInventoryItem = exports.getAllInventoryItems = exports.addInventoryItem = void 0;
const inventoryService_1 = require("../services/inventoryService");
// ฟังก์ชันสำหรับเพิ่มข้อมูลสินค้าคงคลัง
const addInventoryItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const item = req.body;
        const insertId = yield (0, inventoryService_1.createInventoryItem)(item);
        res.status(201).send(Object.assign({ id: insertId }, item));
    }
    catch (error) {
        res.status(500).send(`Error inserting data: ${error}`);
    }
});
exports.addInventoryItem = addInventoryItem;
// ฟังก์ชันสำหรับดึงข้อมูลสินค้าคงคลังทั้งหมด
const getAllInventoryItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const items = yield (0, inventoryService_1.getInventoryItems)();
        res.status(200).send(items);
    }
    catch (error) {
        res.status(500).send(`Error fetching data: ${error}`);
    }
});
exports.getAllInventoryItems = getAllInventoryItems;
// ฟังก์ชันสำหรับอัปเดตข้อมูลสินค้าคงคลัง
const editInventoryItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = parseInt(req.params.id, 10);
        const item = req.body;
        yield (0, inventoryService_1.updateInventoryItem)(id, item);
        res.status(200).send(Object.assign({ id }, item));
    }
    catch (error) {
        res.status(500).send(`Error updating data: ${error}`);
    }
});
exports.editInventoryItem = editInventoryItem;
