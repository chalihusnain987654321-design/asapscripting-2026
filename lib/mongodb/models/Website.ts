import mongoose, { Document, Model, Schema } from "mongoose";

export interface IWebsiteAssignee {
  userId: string;
  userName: string;
}

export interface IWebsite extends Document {
  name: string;
  url: string;
  assignedTo: IWebsiteAssignee[];
  createdAt: Date;
  updatedAt: Date;
}

const WebsiteSchema = new Schema<IWebsite>(
  {
    name:       { type: String, required: true, trim: true },
    url:        { type: String, default: "",    trim: true },
    assignedTo: {
      type: [{ userId: String, userName: String, _id: false }],
      default: [],
    },
  },
  { timestamps: true }
);

WebsiteSchema.index({ "assignedTo.userId": 1 });

const Website: Model<IWebsite> =
  mongoose.models.Website ??
  mongoose.model<IWebsite>("Website", WebsiteSchema);

export default Website;
