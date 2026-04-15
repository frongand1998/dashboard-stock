import dotenv from "dotenv";
import { createApp } from "./app.js";
import { startWatchlistStrategyRefresh } from "./services/watchlistStrategyRefresh.js";

dotenv.config();

const app = createApp();
const port = Number(process.env.PORT ?? 4000);

startWatchlistStrategyRefresh("1h", 45_000);

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
