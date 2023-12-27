import postgres from "postgres";

const sql = postgres(`postgres://${process.env.POSTGRES_HOST}`, {
  port: 5432,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  idle_timeout: 10,
  connect_timeout: 30,
});

export default sql;
