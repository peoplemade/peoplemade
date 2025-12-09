import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import Hash from "./Hash.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// CONNECT TO MONGODB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.error(err));

// ROUTES

// Check if a file hash already exists
app.post("/hash/check", async (req, res) => {
    const { hash } = req.body;

    const exists = await Hash.findOne({ hash });
    if (exists) {
        return res.json({ exists: true, certificateID: exists.certificateID });
    }

    res.json({ exists: false });
});

// Store new file hash
app.post("/hash/store", async (req, res) => {
    const { hash, certificateID } = req.body;

    try {
        await Hash.create({ hash, certificateID });
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err });
    }
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("Server running on port " + PORT));