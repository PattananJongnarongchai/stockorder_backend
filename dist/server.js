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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mysql2_1 = __importDefault(require("mysql2"));
const date_fns_1 = require("date-fns");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = 3001;
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/public/images", express_1.default.static(path_1.default.join(__dirname, "public/images")));
const connection = mysql2_1.default.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "inventoryDB",
});
connection.connect((err) => {
    if (err) {
        console.error("Error connecting to the database:", err);
        return;
    }
    console.log("Connected to the MySQL database.");
});
const formatDate = (date) => (0, date_fns_1.format)(date, "yyyy-MM-dd");
// Authentication Middleware
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(" ")[1];
        jsonwebtoken_1.default.verify(token, SECRET_KEY, (err, user) => {
            if (err) {
                console.error("Token verification failed:", err);
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    }
    else {
        console.error("No authorization header present");
        res.sendStatus(401);
    }
};
// Set up multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const dir = path_1.default.join(__dirname, "public/images");
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
            cb(null, true);
        }
        else {
            cb(new Error("Only .jpg and .png files are allowed!"));
        }
    },
});
// Function to get user from database
const getUserFromDatabase = (username) => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT * FROM users WHERE username = ?";
        connection.query(sql, [username], (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results[0]);
        });
    });
};
app.get("/categories", (req, res) => {
    connection.query("SELECT * FROM categories", (err, results) => {
        if (err) {
            console.error("Error fetching categories:", err);
            res.status(500).send("Error fetching categories.");
        }
        else {
            res.json(results);
        }
    });
});
app.post("/categories", (req, res) => {
    const { name } = req.body;
    const sql = "INSERT INTO categories (name) VALUES (?)";
    connection.query(sql, [name], (err, results) => {
        if (err) {
            console.error("Error adding category:", err);
            res.status(500).send("Error adding category.");
        }
        else {
            res.status(201).send({ id: results.insertId, name });
        }
    });
});
app.get("/products", (req, res) => {
    const { search, startDate, endDate, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    let query = "SELECT * FROM products WHERE 1=1";
    const params = [];
    if (search) {
        query += " AND name LIKE ?";
        params.push(`%${search}%`);
    }
    if (startDate && endDate) {
        query += " AND date BETWEEN ? AND ?";
        params.push(startDate, endDate);
    }
    query += " LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);
    connection.query(query, params, (err, results) => {
        if (err) {
            console.error("Error fetching products:", err);
            res.status(500).send("Error fetching products.");
        }
        else {
            const countQuery = "SELECT COUNT(*) as total FROM products WHERE 1=1";
            connection.query(countQuery, params.slice(0, -2), (countErr, countResults) => {
                if (countErr) {
                    console.error("Error counting products:", countErr);
                    res.status(500).send("Error counting products.");
                }
                else {
                    const total = countResults[0].total;
                    res.json({
                        products: results,
                        totalPages: Math.ceil(total / limit),
                    });
                }
            });
        }
    });
});
app.post("/products", [upload.single("image")], (req, res) => {
    const { name, price, stock, category_id, description } = req.body;
    const image = req.file ? `/public/images/${req.file.filename}` : "";
    const date = formatDate(new Date());
    const sql = "INSERT INTO products (name, price, stock, image, category_id, date, description) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const values = [name, price, stock, image, category_id, date, description];
    connection.query(sql, values, (err, results) => {
        if (err) {
            console.error("Error adding product:", err);
            res.status(500).send("Error adding product");
            return;
        }
        const productId = results.insertId;
        const transactionSql = "INSERT INTO transactions (product_id, quantity, date, total_price, type) VALUES ?";
        const transactionValues = [
            [productId, stock, date, price * stock, "buy"],
        ];
        connection.query(transactionSql, [transactionValues], (err, transactionResults) => {
            if (err) {
                console.error("Error adding transaction:", err);
                res.status(500).send("Error adding transaction");
                return;
            }
            res.status(201).send(Object.assign(Object.assign({ id: productId }, req.body), { image, date }));
        });
    });
});
app.put("/products/:id", upload.single("image"), (req, res) => {
    const { id } = req.params;
    const { name, price, stock, category_id, description } = req.body;
    const image = req.file
        ? `/public/images/${req.file.filename}`
        : req.body.image;
    const date = formatDate(new Date());
    const sql = "UPDATE products SET name = ?, price = ?, stock = ?, image = ?, category_id = ?, date = ?, description = ? WHERE id = ?";
    const values = [
        name,
        price,
        stock,
        image,
        category_id,
        date,
        description,
        id,
    ];
    connection.query(sql, values, (err, results) => {
        if (err) {
            console.error("Error updating product:", err);
            res.status(500).send("Error updating product");
            return;
        }
        res.status(200).send(Object.assign(Object.assign({ id: parseInt(id) }, req.body), { image, date }));
    });
});
app.delete("/products/:id", (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM products WHERE id = ?";
    connection.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Error deleting product:", err);
            res.status(500).send("Error deleting product");
            return;
        }
        res.status(200).send({ id: parseInt(id) });
    });
});
app.get("/history", (req, res) => {
    const sql = `SELECT orders.id as order_id, orders.date, orders.total_price, 
               transactions.product_id, transactions.quantity, 
               products.name, products.price
               FROM orders
               JOIN transactions ON orders.id = transactions.order_id
               JOIN products ON transactions.product_id = products.id`;
    connection.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching history:", err);
            res.status(500).send("Error fetching history.");
        }
        else {
            const transactions = results.map((transaction) => (Object.assign(Object.assign({}, transaction), { price: parseFloat(transaction.price), date: formatDate(new Date(transaction.date)) })));
            res.json(transactions);
        }
    });
});
app.post("/checkout", authenticateJWT, (req, res) => {
    const { cartItems } = req.body;
    const user_id = req.user.id;
    if (!cartItems || cartItems.length === 0) {
        console.error("No items in the cart.");
        return res.status(400).send("No items in the cart.");
    }
    const total_price = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    const date = new Date();
    const formattedDate = formatDate(date);
    const orderSql = "INSERT INTO orders (date, total_price, user_id) VALUES (?, ?, ?)";
    connection.query(orderSql, [formattedDate, total_price, user_id], (err, orderResults) => {
        if (err) {
            console.error("Error processing order:", err);
            return res.status(500).send("Error processing order.");
        }
        const orderId = orderResults.insertId;
        const transactionSql = "INSERT INTO transactions (product_id, quantity, date, total_price, order_id, type) VALUES ?";
        const transactionValues = cartItems.map((item) => [
            item.product.id,
            item.quantity,
            formattedDate,
            item.product.price * item.quantity,
            orderId,
            "sale",
        ]);
        connection.query(transactionSql, [transactionValues], (err, transactionResults) => {
            if (err) {
                console.error("Error processing transaction:", err);
                return res.status(500).send("Error processing transaction.");
            }
            const stockUpdateSql = "UPDATE products SET stock = stock - ? WHERE id = ?";
            const stockUpdatePromises = cartItems.map((item) => new Promise((resolve, reject) => {
                connection.query(stockUpdateSql, [item.quantity, item.product.id], (err, results) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(results);
                });
            }));
            Promise.all(stockUpdatePromises)
                .then(() => {
                // res.status(200).send("Checkout successful.");
            })
                .catch((err) => {
                console.error("Error updating stock:", err);
                res.status(500).send("Error updating stock.");
            });
        });
    });
});
// User registration
app.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    const hashedPassword = yield bcrypt_1.default.hash(password, 10);
    const sql = "INSERT INTO users (username, password) VALUES (?, ?)";
    connection.query(sql, [username, hashedPassword], (err, results) => {
        if (err) {
            console.error("Error registering user:", err);
            res.status(500).send("Error registering user.");
        }
        else {
            res.status(201).send({ id: results.insertId, username });
        }
    });
}));
// User login endpoint
app.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    try {
        const user = yield getUserFromDatabase(username);
        if (!user) {
            return res.status(401).send("Invalid username or password");
        }
        const isPasswordValid = bcrypt_1.default.compareSync(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).send("Invalid username or password");
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username }, SECRET_KEY, {
            expiresIn: "1h",
        });
        res.json({ token, user: { id: user.id, username: user.username } });
    }
    catch (err) {
        console.error("Error during login:", err);
        res.status(500).send("Error during login");
    }
}));
app.get("/orders", (req, res) => {
    const { startDate, endDate, page = 1, limit = 10, } = req.query;
    const offset = (page - 1) * limit;
    let query = `SELECT id, date, total_price, user_id FROM orders`;
    let queryParams = [];
    if (startDate && endDate) {
        query += ` WHERE date BETWEEN ? AND ?`;
        queryParams.push(startDate, endDate);
    }
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(Number(limit), offset);
    connection.query(query, queryParams, (err, results) => {
        if (err) {
            console.error("Error fetching orders:", err);
            res.status(500).send("Error fetching orders.");
        }
        else {
            const formattedResults = results.map((order) => (Object.assign(Object.assign({}, order), { date: (0, date_fns_1.format)(new Date(order.date), "yyyy-MM-dd") })));
            res.json({
                orders: formattedResults,
                totalPages: Math.ceil(results.length / limit),
            });
        }
    });
});
app.get("/details/:orderId", (req, res) => {
    const { orderId } = req.params;
    const sql = `SELECT id, product_id, quantity, total_price, date, order_id, type 
               FROM transactions 
               WHERE order_id = ?`;
    connection.query(sql, [orderId], (err, results) => {
        if (err) {
            console.error("Error fetching order details:", err);
            res.status(500).send("Error fetching order details.");
        }
        else {
            const formattedResults = results.map((transaction) => (Object.assign(Object.assign({}, transaction), { date: (0, date_fns_1.format)(new Date(transaction.date), "yyyy-MM-dd HH:mm:ss") })));
            res.json(formattedResults);
        }
    });
});
app.get("/product-transactions/:productId", (req, res) => {
    const { productId } = req.params;
    const sql = `SELECT id, product_id, quantity, total_price, date, order_id, type 
               FROM transactions 
               WHERE product_id = ?`;
    connection.query(sql, [productId], (err, results) => {
        if (err) {
            console.error("Error fetching product transactions:", err);
            res.status(500).send("Error fetching product transactions.");
        }
        else {
            const formattedResults = results.map((transaction) => (Object.assign(Object.assign({}, transaction), { date: (0, date_fns_1.format)(new Date(transaction.date), "yyyy-MM-dd HH:mm:ss") })));
            res.json(formattedResults);
        }
    });
});
// Fetch user settings
app.get("/users/:id", authenticateJWT, (req, res) => {
    const { id } = req.params;
    const sql = "SELECT id, username FROM users WHERE id = ?";
    connection.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Error fetching user settings:", err);
            return res.status(500).send("Error fetching user settings.");
        }
        if (results.length === 0) {
            return res.status(404).send("User not found.");
        }
        res.json(results[0]);
    });
});
// Update user settings
app.put("/users/:id", authenticateJWT, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { username, password } = req.body;
    const hashedPassword = yield bcrypt_1.default.hash(password, 10);
    const sql = "UPDATE users SET username = ?, password = ? WHERE id = ?";
    connection.query(sql, [username, hashedPassword, id], (err, results) => {
        if (err) {
            console.error("Error updating user settings:", err);
            return res.status(500).send("Error updating user settings.");
        }
        res.status(200).send("User settings updated successfully.");
    });
}));
// Update password endpoint
app.put("/users/:id/password", authenticateJWT, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    if (parseInt(id) !== userId) {
        return res.status(403).send("Forbidden.");
    }
    connection.query("SELECT password FROM users WHERE id = ?", [id], (err, results) => __awaiter(void 0, void 0, void 0, function* () {
        if (err) {
            console.error("Error fetching user:", err);
            return res.status(500).send("Error fetching user.");
        }
        if (results.length === 0) {
            return res.status(404).send("User not found.");
        }
        const user = results[0];
        const validPassword = yield bcrypt_1.default.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(400).send("Current password is incorrect.");
        }
        const hashedPassword = yield bcrypt_1.default.hash(newPassword, 10);
        connection.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, id], (err) => {
            if (err) {
                console.error("Error updating password:", err);
                return res.status(500).send("Error updating password.");
            }
            res.send("Password updated successfully.");
        });
    }));
}));
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
