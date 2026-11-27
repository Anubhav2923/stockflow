import { app } from "./app.ts";

// Start the server using process.env
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

const server = app.listen(PORT, () => {
  console.log(`StockFlow running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});

export { app, server };