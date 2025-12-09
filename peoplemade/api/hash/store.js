import mongoose from "mongoose";
import Hash from "../../models/Hash.js";

const MONGO_URI = process.env.MONGO_URI;

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Only POST allowed" });
    }

    if (!mongoose.connection.readyState) {
        await mongoose.connect(MONGO_URI);
    }

    const { hash, certificateID } = req.body;

    try {
        await Hash.create({ hash, certificateID });
        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}