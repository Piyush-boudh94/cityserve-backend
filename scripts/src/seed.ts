import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = pool;

async function seed() {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO categories (name, icon, description) VALUES
        ('Roads & Potholes', 'road', 'Damaged roads, potholes, and street issues'),
        ('Water Supply', 'droplet', 'Water leaks, supply outages, and quality issues'),
        ('Electricity', 'zap', 'Power outages, faulty streetlights, and electrical hazards'),
        ('Garbage & Sanitation', 'trash-2', 'Waste collection, littering, and public cleanliness'),
        ('Sewage & Drainage', 'waves', 'Blocked drains, sewage leaks, and flooding'),
        ('Parks & Public Spaces', 'tree', 'Maintenance of parks, playgrounds, and public areas'),
        ('Street Lighting', 'lightbulb', 'Broken or missing street lights'),
        ('Public Transport', 'bus', 'Bus stops, route issues, and transport infrastructure')
      ON CONFLICT DO NOTHING
    `);
    console.log("✓ Categories seeded");

    await client.query(`
      INSERT INTO wards (ward_id, name, ward_number, city_name) VALUES
        ('WARD-001', 'North Ward', 1, 'CityServe'),
        ('WARD-002', 'South Ward', 2, 'CityServe'),
        ('WARD-003', 'East Ward', 3, 'CityServe'),
        ('WARD-004', 'West Ward', 4, 'CityServe'),
        ('WARD-005', 'Central Ward', 5, 'CityServe'),
        ('WARD-006', 'Northeast Ward', 6, 'CityServe'),
        ('WARD-007', 'Northwest Ward', 7, 'CityServe'),
        ('WARD-008', 'Southeast Ward', 8, 'CityServe'),
        ('WARD-009', 'Southwest Ward', 9, 'CityServe'),
        ('WARD-010', 'Downtown Ward', 10, 'CityServe')
      ON CONFLICT DO NOTHING
    `);
    console.log("✓ Wards seeded");

    const adminHash = await bcrypt.hash("admin123", 10);
    await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ('Admin User', 'admin@cityserve.com', $1, 'admin', true)
       ON CONFLICT DO NOTHING`,
      [adminHash]
    );

    const workerHash = await bcrypt.hash("worker123", 10);
    await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ('Worker One', 'worker@cityserve.com', $1, 'worker', true)
       ON CONFLICT DO NOTHING`,
      [workerHash]
    );

    await client.query(
      `INSERT INTO users (full_name, phone, role, ward_id, is_active)
       VALUES ('Test Citizen', '+911234567890', 'citizen', 1, true)
       ON CONFLICT DO NOTHING`
    );
    console.log("✓ Users seeded");

    await client.query(`
      INSERT INTO alerts (title, message, type, user_id)
      VALUES ('Welcome to CityServe', 'Thank you for using CityServe. Report civic issues in your area!', 'info', NULL)
      ON CONFLICT DO NOTHING
    `);
    console.log("✓ Alerts seeded");

    console.log("\n✅ All seed data inserted successfully!");
    console.log("\nTest accounts:");
    console.log("  Admin:  admin@cityserve.com / admin123");
    console.log("  Worker: worker@cityserve.com / worker123");
    console.log("  Citizen: phone +911234567890 (use Firebase OTP or request-otp endpoint)");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
