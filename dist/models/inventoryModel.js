"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const promise_1 = require("mysql2/promise");
// สร้างการเชื่อมต่อฐานข้อมูล
exports.pool = (0, promise_1.createPool)({
    host: "localhost",
    user: "root",
    password: "",
    database: "inventoryDB",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
