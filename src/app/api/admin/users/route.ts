import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/env";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// PATCH /api/admin/users - Toggle admin or active status
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireAdmin();

    const body = await request.json() as { userId?: string; isAdmin?: boolean; isActive?: boolean; hasPaid?: boolean };
    const { userId, isAdmin, isActive, hasPaid } = body;

    if (
      !userId ||
      (typeof isAdmin !== "boolean" && typeof isActive !== "boolean" && typeof hasPaid !== "boolean")
    ) {
      return NextResponse.json(
        { error: "userId and one of isAdmin/isActive/hasPaid are required" },
        { status: 400 }
      );
    }

    // Prevent self-demotion / self-deactivation
    if (userId === currentUser.id && isAdmin === false) {
      return NextResponse.json(
        { error: "You cannot remove your own admin status" },
        { status: 400 }
      );
    }
    if (userId === currentUser.id && isActive === false) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const update: { isAdmin?: boolean; isActive?: boolean; hasPaid?: boolean; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (typeof isAdmin === "boolean") update.isAdmin = isAdmin;
    if (typeof isActive === "boolean") update.isActive = isActive;
    if (typeof hasPaid === "boolean") update.hasPaid = hasPaid;

    await db.update(users).set(update).where(eq(users.id, userId));

    const messages: string[] = [];
    if (typeof isAdmin === "boolean") {
      messages.push(isAdmin ? "User promoted to admin" : "Admin status removed");
    }
    if (typeof isActive === "boolean") {
      messages.push(isActive ? "User reactivated" : "User deactivated");
    }
    if (typeof hasPaid === "boolean") {
      messages.push(hasPaid ? "Marked as paid" : "Marked as unpaid");
    }

    return NextResponse.json({
      success: true,
      message: messages.join(" · "),
    });
  } catch (error) {
    console.error("Admin users PATCH error:", error);

    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/users - Delete a user
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await requireAdmin();

    const body = await request.json() as { userId?: string };
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Prevent self-deletion
    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Delete user (picks will cascade delete due to FK constraint)
    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Admin users DELETE error:", error);

    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
