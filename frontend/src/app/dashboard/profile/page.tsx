import { revalidatePath } from "next/cache";
import Image from "next/image";
import { getCurrentUser } from "@/lib/api";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function updateProfile(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.accessToken) return;

  const payload = {
    firstName: String(formData.get("firstName") || "").trim() || undefined,
    lastName: String(formData.get("lastName") || "").trim() || undefined,
  };

  await fetch(`${BACKEND_URL}/user/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  revalidatePath("/dashboard/profile");
}

async function changePassword(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.accessToken) return;

  const payload = {
    currentPassword: String(formData.get("currentPassword") || ""),
    newPassword: String(formData.get("newPassword") || ""),
  };

  await fetch(`${BACKEND_URL}/user/change-password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  revalidatePath("/dashboard/profile");
}

async function uploadAvatar(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.accessToken) return;

  const fd = new FormData();
  const file = formData.get("avatar");
  if (file instanceof File) {
    fd.set("avatar", file);
  }

  await fetch(`${BACKEND_URL}/user/avatar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: fd,
  });

  revalidatePath("/dashboard/profile");
}

export default async function ProfilePage() {
  const me = await getCurrentUser();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal information and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2 space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Personal Information</h2>
            <form action={updateProfile} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="firstName">
                  First Name
                </label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="Enter first name"
                  defaultValue={me.firstName || ""}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="lastName">
                  Last Name
                </label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Enter last name"
                  defaultValue={me.lastName || ""}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email Address
                </label>
                <Input id="email" name="email" value={me.email} disabled />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-medium">Password & Security</h2>
            <form action={changePassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="currentPassword">
                  Current Password
                </label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  placeholder="Enter current password"
                  type="password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="newPassword">
                  New Password
                </label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  placeholder="Enter new password"
                  type="password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="confirmPassword">
                  Confirm New Password
                </label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Confirm new password"
                  type="password"
                />
              </div>
              <Button type="submit">Update Password</Button>
            </form>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-medium">Profile Photo</h2>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-full bg-muted overflow-hidden flex items-center justify-center text-lg font-semibold">
                {me.avatar ? (
                  <Image src={me.avatar} alt="Avatar" fill className="object-cover" />
                ) : (
                  <span>
                    {(me.firstName?.[0] || "").toUpperCase()}
                    {(me.lastName?.[0] || "").toUpperCase()}
                  </span>
                )}
              </div>
              <form action={uploadAvatar} encType="multipart/form-data" className="flex items-center gap-3">
                <Input type="file" name="avatar" accept="image/png,image/jpeg,image/gif" />
                <Button type="submit" variant="secondary">
                  Upload Photo
                </Button>
              </form>
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max size 2MB</p>
          </Card>

          <Card className="p-6 space-y-3">
            <h2 className="text-lg font-medium">Account Details</h2>
            <div className="text-sm">
              <div className="text-muted-foreground">Member since</div>
              <div>
                {new Date(me.createdAt).toLocaleString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground">Email verified</div>
              <div className={me.emailVerified ? "text-green-600" : "text-red-600"}>
                {me.emailVerified ? "Yes" : "No"}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm">
                <div className="font-medium">Two-Factor Authentication</div>
                <div className="text-muted-foreground">Add an extra layer of security</div>
              </div>
              <Switch disabled />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}


