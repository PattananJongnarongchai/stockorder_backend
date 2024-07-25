import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import mysql, { OkPacket, RowDataPacket } from "mysql2";
import { format, parseISO, isValid } from "date-fns";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3001;
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";

app.use(cors());
app.use(express.json());
app.use(
  "/public/images",
  express.static(path.join(__dirname, "public/images"))
);

const connection = mysql.createConnection({
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

const formatDate = (date: Date): string => format(date, "yyyy-MM-dd");

const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1];

    jwt.verify(token, SECRET_KEY, (err: any, user: any) => {
      if (err) {
        console.error("Token verification failed:", err);
        return res.sendStatus(403);
      }

      (req as any).user = user;
      next();
    });
  } else {
    console.error("No authorization header present");
    res.sendStatus(401);
  }
};


// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "public/images");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
      cb(null, true);
    } else {
      cb(new Error("Only .jpg and .png files are allowed!"));
    }
  },
});

// Function to get user from database
const getUserFromDatabase = (username: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM users WHERE username = ?";
    connection.query(sql, [username], (err, results: RowDataPacket[]) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0]);
    });
  });
};

app.get("/api/categories", (req: Request, res: Response) => {
  connection.query(
    "SELECT * FROM categories",
    (err, results: RowDataPacket[]) => {
      if (err) {
        console.error("Error fetching categories:", err);
        res.status(500).send("Error fetching categories.");
      } else {
        res.json(results);
      }
    }
  );
});

app.post("/api/categories", (req: Request, res: Response) => {
  const { name } = req.body;

  const sql = "INSERT INTO categories (name) VALUES (?)";
  connection.query(sql, [name], (err, results: OkPacket) => {
    if (err) {
      console.error("Error adding category:", err);
      res.status(500).send("Error adding category.");
    } else {
      res.status(201).send({ id: results.insertId, name });
    }
  });
});

app.get("/api/products", (req: Request, res: Response) => {
  const { search, startDate, endDate } = req.query as any;

  let query = "SELECT * FROM products WHERE 1=1";
  const params: (string | number)[] = [];

  if (search) {
    query += " AND name LIKE ?";
    params.push(`%${search}%`);
  }
  if (startDate && endDate) {
    query += " AND date BETWEEN ? AND ?";
    params.push(startDate, endDate);
  }

  connection.query(query, params, (err, results: RowDataPacket[]) => {
    if (err) {
      console.error("Error fetching products:", err);
      res.status(500).send("Error fetching products.");
    } else {
      res.json({
        products: results,
      });
    }
  });
});


app.post(
  "/api/products",
  [upload.single("image")],
  (req: Request, res: Response) => {
    const { name, price, stock, category_id, description } = req.body;
    const image = req.file ? `/public/images/${req.file.filename}` : "";
    const date = formatDate(new Date());
    const sql =
      "INSERT INTO products (name, price, stock, image, category_id, date, description) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const values = [name, price, stock, image, category_id, date, description];

    connection.query(sql, values, (err, results: OkPacket) => {
      if (err) {
        console.error("Error adding product:", err);
        res.status(500).send("Error adding product");
        return;
      }

      const productId = results.insertId;
      const transactionSql =
        "INSERT INTO transactions (product_id, quantity, date, total_price, type) VALUES ?";
      const transactionValues = [
        [productId, stock, date, price * stock, "buy"],
      ];

      connection.query(
        transactionSql,
        [transactionValues],
        (err, transactionResults: OkPacket) => {
          if (err) {
            console.error("Error adding transaction:", err);
            res.status(500).send("Error adding transaction");
            return;
          }
          res.status(201).send({ id: productId, ...req.body, image, date });
        }
      );
    });
  }
);

app.put(
  "/api/products/:id",
  upload.single("image"),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, price, stock, category_id, description } = req.body;
    const image = req.file
      ? `/public/images/${req.file.filename}`
      : req.body.image;
    const date = formatDate(new Date());
    const sql =
      "UPDATE products SET name = ?, price = ?, stock = ?, image = ?, category_id = ?, date = ?, description = ? WHERE id = ?";
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

    connection.query(sql, values, (err, results: OkPacket) => {
      if (err) {
        console.error("Error updating product:", err);
        res.status(500).send("Error updating product");
        return;
      }
      res.status(200).send({ id: parseInt(id), ...req.body, image, date });
    });
  }
);

app.delete("/api/products/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const sql = "DELETE FROM products WHERE id = ?";

  connection.query(sql, [id], (err, results: OkPacket) => {
    if (err) {
      console.error("Error deleting product:", err);
      res.status(500).send("Error deleting product");
      return;
    }
    res.status(200).send({ id: parseInt(id) });
  });
});

// app.get("/api/history", (req: Request, res: Response) => {
//   const sql = `SELECT orders.id as order_id, orders.date, orders.total_price, 
//                transactions.product_id, transactions.quantity, 
//                products.name, products.price
//                FROM orders
//                JOIN transactions ON orders.id = transactions.order_id
//                JOIN products ON transactions.product_id = products.id`;

//   connection.query(sql, (err, results: RowDataPacket[]) => {
//     if (err) {
//       console.error("Error fetching history:", err);
//       res.status(500).send("Error fetching history.");
//     } else {
//       const transactions = results.map((transaction: any) => ({
//         ...transaction,
//         price: parseFloat(transaction.price),
//         date: formatDate(new Date(transaction.date)),
//       }));
//       res.json(transactions);
//     }
//   });
// });

app.post("/api/checkout", authenticateJWT, (req: Request, res: Response) => {
  const { cartItems } = req.body;
  const user_id = (req as any).user.id;

  if (!cartItems || cartItems.length === 0) {
    console.error("No items in the cart.");
    return res.status(400).send("No items in the cart.");
  }

  const total_price = cartItems.reduce(
    (acc: number, item: any) => acc + item.product.price * item.quantity,
    0
  );
  const date = new Date();
  const formattedDate = formatDate(date);

  const orderSql =
    "INSERT INTO orders (date, total_price, user_id) VALUES (?, ?, ?)";
  connection.query(
    orderSql,
    [formattedDate, total_price, user_id],
    (err, orderResults: OkPacket) => {
      if (err) {
        console.error("Error processing order:", err);
        return res.status(500).send("Error processing order.");
      }

      const orderId = orderResults.insertId;
      const transactionSql =
        "INSERT INTO transactions (product_id, quantity, date, total_price, order_id, type) VALUES ?";
      const transactionValues = cartItems.map((item: any) => [
        item.product.id,
        item.quantity,
        formattedDate,
        item.product.price * item.quantity,
        orderId,
        "sale",
      ]);

      connection.query(
        transactionSql,
        [transactionValues],
        (err, transactionResults: OkPacket) => {
          if (err) {
            console.error("Error processing transaction:", err);
            return res.status(500).send("Error processing transaction.");
          }

          const stockUpdateSql =
            "UPDATE products SET stock = stock - ? WHERE id = ?";
          const stockUpdatePromises = cartItems.map(
            (item: any) =>
              new Promise((resolve, reject) => {
                connection.query(
                  stockUpdateSql,
                  [item.quantity, item.product.id],
                  (err, results: OkPacket) => {
                    if (err) {
                      return reject(err);
                    }
                    resolve(results);
                  }
                );
              })
          );

          Promise.all(stockUpdatePromises)
            .then(() => {
              // res.status(200).send("Checkout successful.");
            })
            .catch((err) => {
              console.error("Error updating stock:", err);
              res.status(500).send("Error updating stock.");
            });
        }
      );
    }
  );
});

// User registration endpoint
app.post("/api/register", async (req: Request, res: Response) => {
  const { username, password, user_role = 'user' } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = "INSERT INTO users (username, password, user_role) VALUES (?, ?, ?)";
  connection.query(
    sql,
    [username, hashedPassword, user_role],
    (err, results: OkPacket) => {
      if (err) {
        console.error("Error registering user:", err);
        res.status(500).send("Error registering user.");
      } else {
        res.status(201).send({ id: results.insertId, username, user_role });
      }
    }
  );
});


app.post("/api/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const user = await getUserFromDatabase(username);

    if (!user) {
      return res.status(401).send("Invalid username or password");
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).send("Invalid username or password");
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role }, // Include role in the token
      SECRET_KEY,
      {
        expiresIn: "1h",
      }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    }); // Include role in the response
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).send("Error during login");
  }
});


app.get("/api/orders", (req: Request, res: Response) => {
  const {
    startDate,
    endDate,
    page = 1,
    limit = 10,
  } = req.query as unknown as {
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  };

  const offset = (page - 1) * limit;

  let query = `SELECT id, date, total_price, user_id FROM orders`;
  let queryParams: (string | number)[] = [];

  if (startDate && endDate) {
    query += ` WHERE date BETWEEN ? AND ?`;
    queryParams.push(startDate, endDate);
  }

  query += ` LIMIT ? OFFSET ?`;
  queryParams.push(Number(limit), offset);

  connection.query(query, queryParams, (err, results: RowDataPacket[]) => {
    if (err) {
      console.error("Error fetching orders:", err);
      res.status(500).send("Error fetching orders.");
    } else {
      const formattedResults = results.map((order: any) => ({
        ...order,
        date: format(new Date(order.date), "yyyy-MM-dd"),
      }));
      res.json({
        orders: formattedResults,
        totalPages: Math.ceil(results.length / limit),
      });
    }
  });
});

app.get("/api/details/:orderId", (req: Request, res: Response) => {
  const { orderId } = req.params;

  const sql = `SELECT id, product_id, quantity, total_price, date, order_id, type 
               FROM transactions 
               WHERE order_id = ?`;

  connection.query(sql, [orderId], (err, results: RowDataPacket[]) => {
    if (err) {
      console.error("Error fetching order details:", err);
      res.status(500).send("Error fetching order details.");
    } else {
      const formattedResults = results.map((transaction: any) => ({
        ...transaction,
        date: format(new Date(transaction.date), "yyyy-MM-dd HH:mm:ss"),
      }));
      res.json(formattedResults);
    }
  });
});

app.get(
  "/api/product-transactions/:productId",
  (req: Request, res: Response) => {
    const { productId } = req.params;

    const sql = `SELECT id, product_id, quantity, total_price, date, order_id, type 
               FROM transactions 
               WHERE product_id = ?`;

    connection.query(sql, [productId], (err, results: RowDataPacket[]) => {
      if (err) {
        console.error("Error fetching product transactions:", err);
        res.status(500).send("Error fetching product transactions.");
      } else {
        const formattedResults = results.map((transaction: any) => ({
          ...transaction,
          date: format(new Date(transaction.date), "yyyy-MM-dd HH:mm:ss"),
        }));
        res.json(formattedResults);
      }
    });
  }
);
app.get("/api/user-orders/:userId", (req: Request, res: Response) => {
  const { userId } = req.params;
  const { startDate, endDate } = req.query;

  const sql = `
    SELECT DATE(date) as date, SUM(total_price) as total
    FROM orders
    WHERE user_id = ? AND date BETWEEN ? AND ?
    GROUP BY DATE(date)
    ORDER BY DATE(date)
  `;

  connection.query(
    sql,
    [userId, startDate, endDate],
    (err, results: RowDataPacket[]) => {
      if (err) {
        console.error("Error fetching user orders:", err);
        return res.status(500).send("Error fetching user orders.");
      }
      res.json(results);
    }
  );
});
// Fetch all user transactions for admin
app.get("/api/admin/user-transactions", authenticateJWT, (req: Request, res: Response) => {
  const { role } = (req as any).user;

  if (role !== "admin") {
    return res.status(403).send("Access denied");
  }

  const sql = `SELECT u.id as user_id, u.username, t.date, 
                SUM(t.total_price) as total_price 
                FROM users u
                JOIN transactions t ON u.id = t.user_id
                GROUP BY u.id, DATE(t.date)
                ORDER BY t.date DESC`;

  connection.query(sql, (err, results: RowDataPacket[]) => {
    if (err) {
      console.error("Error fetching user transactions:", err);
      res.status(500).send("Error fetching user transactions.");
    } else {
      res.json(results);
    }
  });
});

// Fetch all user transactions for admin
app.get("/api/admin/user-transactions", authenticateJWT, (req: Request, res: Response) => {
  const { role } = (req as any).user;
  const { startDate, endDate, page = 1, limit = 10 } = req.query as any;

  if (role !== "admin") {
    return res.status(403).send("Access denied");
  }

  const offset = (page - 1) * limit;

  let query = `SELECT u.id as user_id, u.username, DATE(t.date) as date, 
                SUM(t.total_price) as total_price 
                FROM users u
                JOIN transactions t ON u.id = t.user_id
                WHERE 1=1`;
  const queryParams: any[] = [];

  if (startDate && endDate) {
    query += ` AND DATE(t.date) BETWEEN ? AND ?`;
    queryParams.push(startDate, endDate);
  }

  query += ` GROUP BY u.id, DATE(t.date)
             ORDER BY DATE(t.date) DESC
             LIMIT ? OFFSET ?`;
  queryParams.push(Number(limit), offset);

  connection.query(query, queryParams, (err, results: RowDataPacket[]) => {
    if (err) {
      console.error("Error fetching user transactions:", err);
      res.status(500).send("Error fetching user transactions.");
    } else {
      res.json(results);
    }
  });
});



// Fetch user settings
app.get("/api/users/:id", authenticateJWT, (req: Request, res: Response) => {
  const { id } = req.params;

  const sql = "SELECT id, username FROM users WHERE id = ?";
  connection.query(sql, [id], (err, results: RowDataPacket[]) => {
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
app.put(
  "/api/users/:id",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { username, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = "UPDATE users SET username = ?, password = ? WHERE id = ?";

    connection.query(
      sql,
      [username, hashedPassword, id],
      (err, results: OkPacket) => {
        if (err) {
          console.error("Error updating user settings:", err);
          return res.status(500).send("Error updating user settings.");
        }
        res.status(200).send("User settings updated successfully.");
      }
    );
  }
);

// Update password endpoint
app.put(
  "/api/users/:id/password",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    const userId = (req as any).user.id;

    if (parseInt(id) !== userId) {
      return res.status(403).send("Forbidden.");
    }

    connection.query(
      "SELECT password FROM users WHERE id = ?",
      [id],
      async (err, results: RowDataPacket[]) => {
        if (err) {
          console.error("Error fetching user:", err);
          return res.status(500).send("Error fetching user.");
        }

        if (results.length === 0) {
          return res.status(404).send("User not found.");
        }

        const user = results[0];
        const validPassword = await bcrypt.compare(
          currentPassword,
          user.password
        );

        if (!validPassword) {
          return res.status(400).send("Current password is incorrect.");
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        connection.query(
          "UPDATE users SET password = ? WHERE id = ?",
          [hashedPassword, id],
          (err: any) => {
            if (err) {
              console.error("Error updating password:", err);
              return res.status(500).send("Error updating password.");
            }

            res.send("Password updated successfully.");
          }
        );
      }
    );
  }
);
app.get("/api/history", (req: Request, res: Response) => {
  const { search, startDate, endDate, page = 1, limit = 10 } = req.query as any;
  const offset = (page - 1) * limit;

  let query = "SELECT * FROM products WHERE 1=1";
  const params: (string | number)[] = [];

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

  connection.query(query, params, (err, results: RowDataPacket[]) => {
    if (err) {
      console.error("Error fetching products:", err);
      res.status(500).send("Error fetching products.");
    } else {
      const countQuery = "SELECT COUNT(*) as total FROM products WHERE 1=1";
      const countParams = params.slice(0, -2); // Remove LIMIT and OFFSET parameters
      connection.query(
        countQuery,
        countParams,
        (countErr, countResults: RowDataPacket[]) => {
          if (countErr) {
            console.error("Error counting products:", countErr);
            res.status(500).send("Error counting products.");
          } else {
            const total = countResults[0].total;
            res.json({
              products: results,
              totalPages: Math.ceil(total / limit),
            });
          }
        }
      );
    }
  });
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
