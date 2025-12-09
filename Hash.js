import mongoose from "mongoose";

const HashSchema = new mongoose.Schema({
    hash: { type: String, unique: true, required: true },
    certificateID: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

export default mongoose.model("Hash", HashSchema);
