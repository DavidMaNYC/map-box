import express, { Request, Response } from "express";
import cors from "cors";
import { Pool } from "pg";
import dotenv from "dotenv";
import redis from "./redis";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

/**
 * Creates the 'polygons' table in the database if it does not already exist.
 */
const createTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS polygons (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      coordinates JSONB NOT NULL,
      session_id UUID NOT NULL
    );
  `;
  try {
    await pool.query(createTableQuery);
    console.log("Table 'polygons' created or already exists.");
  } catch (err) {
    console.error("Error creating table 'polygons':", err);
  }
};

pool.connect((err, client, done) => {
  if (err) {
    console.error("Error connecting to the database", err.stack);
  } else {
    console.log("Connected to the database");
    createTable().finally(() => done());
  }
});

/**
 * Checks if the polygon has at least three points and forms a closed loop.
 * @param {Array<[number, number]>} coordinates - The coordinates of the polygon.
 * @returns {boolean} - True if the polygon is valid, false otherwise.
 */
const isValidPolygon = (coordinates: [number, number][]) => {
  return coordinates.length > 2;
};

// Middleware to check cache
const checkCache = async (req: Request, res: Response, next: () => void) => {
  try {
    const polygons = await redis.get("polygons");
    if (polygons) {
      return res.json(JSON.parse(polygons));
    }
    next();
  } catch (err) {
    console.error("Redis error:", err);
    next();
  }
};

/**
 * Endpoint to create a new polygon.
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 */
app.post("/polygons", async (req: Request, res: Response) => {
  const { name, coordinates, sessionId } = req.body;

  if (!name || !coordinates || !isValidPolygon(coordinates)) {
    return res.status(400).json({ error: "Invalid polygon data" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO polygons (name, coordinates, session_id) VALUES ($1, $2, $3) RETURNING *",
      [name, JSON.stringify(coordinates), sessionId]
    );
    const savedPolygon = result.rows[0];
    const polygons = await getPolygonsFromDB();
    await redis.set("polygons", JSON.stringify(polygons), "EX", 3600);
    res.status(201).json({ savedPolygon });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Endpoint to fetch all polygons.
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 */
app.get("/polygons", checkCache, async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM polygons");
    const polygons = result.rows;
    await redis.set("polygons", JSON.stringify(polygons), "EX", 3600);
    res.status(200).json(polygons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Endpoint to update a polygon by ID.
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 */
app.put("/polygons/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, coordinates } = req.body;

  if (!name || !coordinates || !isValidPolygon(coordinates)) {
    return res.status(400).json({ error: "Invalid polygon data" });
  }

  try {
    const result = await pool.query(
      "UPDATE polygons SET name = $1, coordinates = $2 WHERE id = $3 RETURNING *",
      [name, JSON.stringify(coordinates), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Polygon not found" });
    }

    const updatedPolygon = result.rows[0];
    const polygons = await getPolygonsFromDB();
    await redis.set("polygons", JSON.stringify(polygons), "EX", 3600);
    res.status(200).json(updatedPolygon);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Endpoint to delete a polygon by ID.
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 */
app.delete("/polygons/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM polygons WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Polygon not found" });
    }

    const polygons = await getPolygonsFromDB();
    await redis.set("polygons", JSON.stringify(polygons), "EX", 3600);
    res.status(200).json({ message: "Polygon deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
interface Polygon {
  id: number;
  name: string;
  coordinates: [number, number][];
  session_id: string;
}

/**
 * Fetch all polygons from the database.
 * @returns {Promise<Polygon[]>} - The list of polygons.
 */
const getPolygonsFromDB = async (): Promise<Polygon[]> => {
  const result = await pool.query("SELECT * FROM polygons");
  return result.rows as Polygon[];
};

if (process.env.NODE_ENV !== "test") {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export { app, pool };
