require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { createApp } = require("./app");

const PORT = Number(process.env.PORT) || 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`Constructora GG API listening on http://127.0.0.1:${PORT}`);
});
