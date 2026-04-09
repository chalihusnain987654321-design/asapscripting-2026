import mongoose, { Document, Model, Schema } from "mongoose";

export type BacklinkStatus = "live" | "pending" | "broken" | "removed";
export type BacklinkType =
  | "guest-post"
  | "directory"
  | "forum"
  | "social"
  | "article"
  | "comment"
  | "press-release"
  | "other";

export interface IBacklink extends Document {
  userId: string;
  userName: string;
  userEmail: string;
  websiteName: string;
  targetUrl: string;
  backlinkUrl: string;
  anchorText: string;
  type: BacklinkType;
  da: number | null;
  status: BacklinkStatus;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const BacklinkSchema = new Schema<IBacklink>(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    websiteName: { type: String, required: true, trim: true },
    targetUrl: { type: String, default: "", trim: true },
    backlinkUrl: { type: String, required: true, trim: true },
    anchorText: { type: String, default: "", trim: true },
    type: {
      type: String,
      enum: ["guest-post", "directory", "forum", "social", "article", "comment", "press-release", "other"],
      default: "other",
    },
    da: { type: Number, default: null },
    status: {
      type: String,
      enum: ["live", "pending", "broken", "removed"],
      default: "live",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

BacklinkSchema.index({ userId: 1 });
BacklinkSchema.index({ websiteName: 1 });
BacklinkSchema.index({ status: 1 });
BacklinkSchema.index({ createdAt: -1 });

const Backlink: Model<IBacklink> =
  mongoose.models.Backlink ?? mongoose.model<IBacklink>("Backlink", BacklinkSchema);

export default Backlink;
