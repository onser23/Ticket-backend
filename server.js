require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { connectDB } = require("./config/db");

const app = express();

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// app.use(cors({
//   origin: process.env.FRONTEND_URL || 'http://localhost:3000',
//   credentials: true,
// }));

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept",
  );
  next();
});

app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("dev"));
app.use(
  "/uploads/tickets",
  express.static("uploads/tickets", {
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=86400");
    },
  }),
);

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin/auth", require("./routes/adminAuth"));
app.use("/api/companies", require("./routes/companies"));
app.use("/api/profile", require("./routes/profile"));
app.use("/api/admin/profile", require("./routes/adminProfile"));
app.use("/api/tickets", require("./routes/tickets"));
app.use("/api/comments", require("./routes/comments"));
app.use("/api/stats", require("./routes/stats"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Ticket Sistemi API işləyir" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route tapılmadı" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Daxili server xətası",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

if (require.main === module && process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`🚀 Server ${PORT} portunda işləyir`);
  });
}

module.exports = app;
