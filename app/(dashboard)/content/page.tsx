import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, ContentTask, Group } from "@/lib/mongodb";
import { ContentClient, type ContentTaskRow } from "./content-client";

export default async function ContentPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  const myId = session!.user.id;

  await connectDB();

  const filter: Record<string, unknown> = {};

  if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    const memberIds = group ? group.memberUserIds.map((id) => id.toString()) : [];
    filter.userId = { $in: [myId, ...memberIds] };
  } else if (role !== "super-admin") {
    filter.userId = myId;
  }

  const raw = await ContentTask.find(filter).sort({ date: -1, createdAt: -1 }).lean();

  const tasks: ContentTaskRow[] = raw.map((t) => ({
    id: t._id.toString(),
    userId: t.userId,
    userName: t.userName,
    taskType: t.taskType as ContentTaskRow["taskType"],
    websiteName: t.websiteName,
    websiteUrl: t.websiteUrl,
    status: t.status as ContentTaskRow["status"],
    date: t.date.toISOString(),
    docsLink: t.docsLink ?? "",
    pageUrls: t.pageUrls ?? [],
    sheetLink: t.sheetLink ?? "",
    updatedPageLinks: t.updatedPageLinks ?? [],
    publishedBlogLinks: t.publishedBlogLinks ?? [],
  }));

  return (
    <Suspense>
      <ContentClient
        tasks={tasks}
        currentUserId={myId}
        viewerRole={role}
      />
    </Suspense>
  );
}
