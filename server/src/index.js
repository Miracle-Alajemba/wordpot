import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "wordpot-server",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/meta", (_req, res) => {
  res.json({
    name: "WordPot",
    entryFee: "0.1 cUSD",
    roundDurationSeconds: 60,
    minPlayers: 2,
    maxPlayers: 5,
    minWordLength: 3,
  });
});

app.listen(port, () => {
  console.log(`WordPot server listening on http://localhost:${port}`);
});

