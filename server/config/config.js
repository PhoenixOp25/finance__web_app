const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const connectDB = async () => {
  const url = process.env.MONGO_URI;
  mongoose.connect(url)
    .then(() => {
      console.log("MongoDB connected");
    })
    .catch((error) => {
      console.error("MongoDB Connection Error:", error.message);
      process.exit(1);
    });
}

module.exports = connectDB;
