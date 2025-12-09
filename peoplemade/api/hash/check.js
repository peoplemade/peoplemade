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

    const { hash } = req.body;

    const exists = await Hash.findOne({ hash });

    if (exists) {
        return res.status(200).json({
            exists: true,
            certificateID: exists.certificateID
        });
    }

    res.status(200).json({ exists: false });
}
