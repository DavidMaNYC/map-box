import { pool } from "./server";
import redis from "./redis";

const seedDatabase = async () => {
  const samplePolygons = [
    {
      name: "Polygon 1",
      coordinates: [
        [-73.935242, 40.73061],
        [-73.935242, 40.74061],
        [-73.925242, 40.74061],
      ],
      session_id: "00000000-0000-0000-0000-000000000000",
    },
    {
      name: "Polygon 2",
      coordinates: [
        [-73.935242, 40.73061],
        [-73.935242, 40.74061],
        [-73.925242, 40.74061],
        [-73.925242, 40.73061],
      ],
      session_id: "00000000-0000-0000-0000-000000000000",
    },
  ];

  try {
    for (const polygon of samplePolygons) {
      await pool.query(
        "INSERT INTO polygons (name, coordinates, session_id) VALUES ($1, $2, $3)",
        [polygon.name, JSON.stringify(polygon.coordinates), polygon.session_id]
      );
    }

    const result = await pool.query("SELECT * FROM polygons");
    await redis.set("polygons", JSON.stringify(result.rows), "EX", 3600);
    console.log("Database seeded and cache set");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await pool.end();
    redis.disconnect();
  }
};

seedDatabase()
  .then(() => process.exit())
  .catch(console.error);
