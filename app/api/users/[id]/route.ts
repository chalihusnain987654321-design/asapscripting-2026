import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, User } from "@/lib/mongodb";

// Role rank: higher = more powerful
function roleRank(role?: string): number {
  if (role === "super-admin") return 3;
  if (role === "admin") return 2;
  return 1;
}

// PATCH /api/users/[id] — update role or isActive
// Rules:
//   - You cannot modify your own account here
//   - You can only modify users with strictly lower role rank than yourself
//   - You can only assign roles up to your own rank
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const myRole = session?.user.role;

  if (roleRank(myRole) < 2) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (params.id === session!.user.id) {
    return Response.json({ error: "You cannot modify your own account here." }, { status: 400 });
  }

  await connectDB();

  const target = await User.findById(params.id);
  if (!target) return Response.json({ error: "User not found." }, { status: 404 });

  // Cannot modify a user with equal or higher rank
  if (roleRank(target.role) >= roleRank(myRole)) {
    return Response.json(
      { error: "You do not have permission to modify this account." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const allowedFields: Record<string, unknown> = {};

  if ("isActive" in body) allowedFields.isActive = Boolean(body.isActive);

  if ("role" in body) {
    const newRole = body.role as string;
    const allowedRoles = myRole === "super-admin"
      ? ["admin", "super-admin"]
      : ["admin"];

    if (allowedRoles.includes(newRole) && roleRank(newRole) <= roleRank(myRole)) {
      allowedFields.role = newRole;
    }
  }

  if (Object.keys(allowedFields).length === 0) {
    return Response.json({ error: "No valid fields to update." }, { status: 400 });
  }

  // Prevent removing the last super-admin
  if (
    (allowedFields.role === "admin" || allowedFields.role === "member" || allowedFields.isActive === false) &&
    target.role === "super-admin"
  ) {
    const superAdminCount = await User.countDocuments({ role: "super-admin", isActive: true });
    if (superAdminCount <= 1) {
      return Response.json(
        { error: "Cannot demote or deactivate the last super-admin." },
        { status: 400 }
      );
    }
  }

  const updated = await User.findByIdAndUpdate(params.id, allowedFields, { new: true }).lean();
  if (!updated) return Response.json({ error: "User not found." }, { status: 404 });

  return Response.json({
    id: updated._id.toString(),
    name: updated.name,
    email: updated.email,
    role: updated.role,
    isActive: updated.isActive,
    createdAt: updated.createdAt.toISOString(),
  });
}
