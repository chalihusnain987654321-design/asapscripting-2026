import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, ContentTask, Group } from "@/lib/mongodb";
import { ContentClient, type ContentTaskRow, type TaskType } from "./content-client";

const VALID_TYPES: TaskType[] = ["landing-request", "blog-request", "landing-update", "blog-publish"];

const TYPE_LABELS: Record<TaskType, string> = {
  "landing-request": "Landing Pages Request",
  "blog-request": "Blogs Request",
  "landing-update": "Landing Pages Update",
  "blog-publish": "Blogs Publish",
};

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const taskType = searchParams.type as TaskType;

  // Default redirect to first sub-task
  if (!VALID_TYPES.includes(taskType)) {
    redirect("/content?type=landing-request");
  }

  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  const myId = session!.user.id;

  await connectDB();

  const filter: Record<string, unknown> = { taskType };

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
    taskType: t.taskType as TaskType,
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
        taskType={taskType}
        pageTitle={TYPE_LABELS[taskType]}
        currentUserId={myId}
        viewerRole={role}
      />
    </Suspense>
  );
}
