import request from "supertest";
import { app } from "../server";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Mock the pool.query function
jest.mock("pg", () => {
  const mPool = {
    query: jest.fn(),
    connect: jest.fn((callback) => callback(null, {}, () => {})),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe("Polygon API", () => {
  it("should create a new polygon", async () => {
    const newPolygon = {
      name: "Test Polygon",
      coordinates: [
        [-73.935242, 40.73061],
        [-73.935242, 40.3061],
        [-73.935242, 40.43061],
      ],
      sessionId: "some-session-id",
    };

    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          name: newPolygon.name,
          coordinates: JSON.stringify(newPolygon.coordinates),
        },
      ],
    });

    const response = await request(app)
      .post("/polygons")
      .send(newPolygon)
      .expect("Content-Type", /json/)
      .expect(201);

    expect(response.body).toEqual({
      polygon: {
        id: 1,
        name: "Test Polygon",
        coordinates: JSON.stringify([
          [-73.935242, 40.73061],
          [-73.935242, 40.3061],
          [-73.935242, 40.43061],
        ]),
      },
      sessionId: "some-session-id",
    });
  });

  it("should return a list of polygons", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          name: "Polygon 1",
          coordinates: JSON.stringify([[-73.935242, 40.73061]]),
        },
      ],
    });

    const response = await request(app)
      .get("/polygons")
      .expect("Content-Type", /json/)
      .expect(200);

    expect(response.body).toEqual([
      {
        id: 1,
        name: "Polygon 1",
        coordinates: JSON.stringify([[-73.935242, 40.73061]]),
      },
    ]);
  });

  it("should update a polygon", async () => {
    const updatedPolygon = {
      id: 1,
      name: "Test Polygon",
      coordinates: [
        [-73.935242, 40.73061],
        [-73.935242, 40.3061],
        [-73.935242, 40.43061],
      ],
    };

    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          name: updatedPolygon.name,
          coordinates: JSON.stringify(updatedPolygon.coordinates),
        },
      ],
    });

    const response = await request(app)
      .put("/polygons/1")
      .send(updatedPolygon)
      .expect("Content-Type", /json/)
      .expect(200);

    expect(response.body).toEqual({
      id: 1,
      name: "Test Polygon",
      coordinates: JSON.stringify([
        [-73.935242, 40.73061],
        [-73.935242, 40.3061],
        [-73.935242, 40.43061],
      ]),
    });
  });

  it("should delete a polygon", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 1,
        },
      ],
    });

    await request(app).delete("/polygons/1").expect(200, {
      message: "Polygon deleted successfully",
    });
  });
});

export default app;
