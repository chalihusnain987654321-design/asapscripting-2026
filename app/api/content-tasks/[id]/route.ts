import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, ContentTask, Group } from "@/lib/mongodb";

async function canAccess(userId: string, role: string, myId: string): Promise<boolean> {
  if (role === "super-admin") return true;
  if (userId === myId) return true;
  if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    if (group) {
      return group.memberUserIds.map((id) => id.toString()).includes(userId);
    }
  }
  return false;
}

// PATCH /api/content-tasks/[id]
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const task = await ContentTask.findById(params.id);
  if (!task) return Response.json({ error: "Not found." }, { status: 404 });

  if (!(await canAccess(task.userId, session.user.role, session.user.id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const allowed = ["websiteName", "websiteUrl", "status", "date", "docsLink", "pageUrls", "sheetLink", "blogTopics", "updatedPageLinks", "publishedBlogLinks"];

  for (const key of allowed) {
    if (key in body) {
      if (key === "date") {
        (task as Record<string, unknown>)[key] = new Date(body[key]);
      } else {
        (task as Record<string, unknown>)[key] = body[key];
      }
    }
  }

  await task.save();
  return Response.json({ id: task._id.toString() });
}

// DELETE /api/content-tasks/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const task = await ContentTask.findById(params.id);
  if (!task) return Response.json({ error: "Not found." }, { status: 404 });

  if (!(await canAccess(task.userId, session.user.role, session.user.id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await task.deleteOne();
  return Response.json({ success: true });
}
