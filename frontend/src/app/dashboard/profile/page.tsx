import { revalidatePath } from "next/cache";
import Image from "next/image";
import { getCurrentUser } from "@/lib/api";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import Breadcrumb from "@/components/dashboard/breadcrumb";
import { User as UserIcon, Lock, Calendar, Mail, Save } from "lucide-react";
import ProfilePhotoCard from "@/components/dashboard/profile-photo-card";
import MainButton from "@/components/main-button";
import PasskeySection from "@/components/profile/PasskeySection";

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

  await fetch(`${BACKEND_URL}/users/profile`, {
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

  await fetch(`${BACKEND_URL}/users/change-password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  revalidatePath("/dashboard/profile");
}

// Upload handled client-side in ProfilePhotoCard to bypass Next.js server action body size limits

export default async function ProfilePage() {
  const me = await getCurrentUser();

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "Profile" },
        ]}
        className="mb-1"
      />
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal information and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-medium">Personal Information</h2>
            </div>
            <form id="profile-form" action={updateProfile} className="grid gap-4 sm:grid-cols-2">
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
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="phone">
                  Phone Number
                </label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="Enter phone number"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="jobTitle">
                  Job Title
                </label>
                <Input
                  id="jobTitle"
                  name="jobTitle"
                  placeholder="Enter job title"
                  disabled
                />
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-medium">Password & Security</h2>
            </div>
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
              <div className="border rounded-md p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">Two-Factor Authentication</div>
                  <div className="text-sm text-muted-foreground">Add an extra layer of security to your account</div>
                </div>
                <Switch disabled />
              </div>
              <PasskeySection />
              <div className="flex items-center gap-2 justify-end">
              <MainButton type="submit">Update Password</MainButton>
              <MainButton type="submit" form="profile-form"><Save className="h-4 w-4 mr-2" />Save Changes</MainButton>
              </div>
            </form>
          </div>
        </Card>

        <div className="space-y-6">
          <ProfilePhotoCard firstName={me.firstName} lastName={me.lastName} avatarUrl={me.avatar} />

          <Card className="p-6 space-y-3">
            <h2 className="text-lg font-medium">Account Details</h2>
            <div className="text-sm">
              <div className="text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" /> Member since</div>
              <div>
                {new Date(me.createdAt).toLocaleString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" /> Email verified</div>
              <div className={me.emailVerified ? "text-green-600" : "text-red-600"}>
                {me.emailVerified ? "Yes" : "No"}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}


