import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  path: {
    type: String,
    required : true,
  },
  fileName: {
    type: String,
    required : true,
  },
  user : {
    type : mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
});

export default mongoose.models.File || mongoose.model("File", fileSchema)