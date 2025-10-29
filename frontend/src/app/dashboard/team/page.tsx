"use client"

import { useMemo, useState } from "react"
import { Users, MoreHorizontal, Search, Filter as FilterIcon, Check, X } from "lucide-react"
import Breadcrumb from "@/components/dashboard/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface TeamMember {
	id: string
	name: string
	email: string
	role: "Owner" | "Admin" | "Member" | "Viewer"
	status: "Active" | "Inactive" | "Pending"
	joined: string
	lastActive: string
}

const initialMembers: TeamMember[] = [
	{ id: "1", name: "John Doe", email: "john@acmetech.com", role: "Admin", status: "Active", joined: "Jan 10, 2022", lastActive: "Today" },
	{ id: "2", name: "Jane Smith", email: "jane@acmetech.com", role: "Admin", status: "Active", joined: "Feb 15, 2022", lastActive: "Yesterday" },
	{ id: "3", name: "Robert Johnson", email: "robert@acmetech.com", role: "Member", status: "Active", joined: "Mar 22, 2022", lastActive: "3 days ago" },
	{ id: "4", name: "Sarah Williams", email: "sarah@acmetech.com", role: "Member", status: "Active", joined: "Apr 5, 2022", lastActive: "1 week ago" },
	{ id: "5", name: "Michael Brown", email: "michael@acmetech.com", role: "Viewer", status: "Inactive", joined: "May 12, 2022", lastActive: "1 month ago" },
	{ id: "6", name: "Emily Davis", email: "emily@gmail.com", role: "Member", status: "Pending", joined: "Jun 8, 2022", lastActive: "Never" },
]

function StatusPill({ status }: { status: TeamMember["status"] }) {
	const styles =
		status === "Active"
			? "text-emerald-600 bg-emerald-50 border-emerald-200"
			: status === "Inactive"
			? "text-rose-600 bg-rose-50 border-rose-200"
			: "text-amber-600 bg-amber-50 border-amber-200"
	return (
		<span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${styles}`}>
			{status === "Active" ? <Check className="h-3 w-3" /> : status === "Inactive" ? <X className="h-3 w-3" /> : null}
			{status}
		</span>
	)
}

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2)
}

export default function TeamPage() {
	const [members] = useState<TeamMember[]>(initialMembers)
	const [search, setSearch] = useState("")
	const [roleFilter, setRoleFilter] = useState<string>("all")
	const [statusFilter, setStatusFilter] = useState<string>("all")
	const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
	const [inviteEmail, setInviteEmail] = useState("")
	const [inviteRole, setInviteRole] = useState<string>("")
	const [inviteMessage, setInviteMessage] = useState("")

	const handleInviteSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!inviteEmail || !inviteRole) {
			return
		}
		// TODO: Integrate with backend API
		console.log("Inviting:", { email: inviteEmail, role: inviteRole, message: inviteMessage })
		// Reset form and close dialog
		setInviteEmail("")
		setInviteRole("")
		setInviteMessage("")
		setIsInviteDialogOpen(false)
	}

	const filteredMembers = useMemo(() => {
		return members.filter((m) => {
			const matchesSearch =
				search.trim() === "" ||
				m.name.toLowerCase().includes(search.toLowerCase()) ||
				m.email.toLowerCase().includes(search.toLowerCase())
			const matchesRole = roleFilter === "all" || m.role.toLowerCase() === roleFilter
			const matchesStatus = statusFilter === "all" || m.status.toLowerCase() === statusFilter
			return matchesSearch && matchesRole && matchesStatus
		})
	}, [members, roleFilter, statusFilter, search])

	return (
		<div className="bg-background min-h-full p-6">
			<div className="bg-white dark:bg-card rounded-lg p-6 shadow-sm">
				<Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Team" }]} className="mb-6" />

				<div className="mb-6 flex items-center justify-between">
					<div>
						<h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1">Team</h1>
						<p className="text-muted-foreground">Manage your team members and their permissions.</p>
					</div>
					<Button variant="secondary" className="gap-2" onClick={() => setIsInviteDialogOpen(true)}>
						<Users className="h-4 w-4" /> Invite Members
					</Button>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
					<div className="flex items-center gap-2 w-full sm:w-auto">
						<div className="relative w-full sm:w-72">
							<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search team members..."
								className="pl-8"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>
						<Button variant="outline" className="gap-2">
							<FilterIcon className="h-4 w-4" /> Filter
						</Button>
					</div>
					<div className="flex items-center gap-2">
						<Select value={roleFilter} onValueChange={setRoleFilter}>
							<SelectTrigger className="w-[140px]"><SelectValue placeholder="All Roles" /></SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Roles</SelectItem>
								<SelectItem value="owner">Owner</SelectItem>
								<SelectItem value="admin">Admin</SelectItem>
								<SelectItem value="member">Member</SelectItem>
								<SelectItem value="viewer">Viewer</SelectItem>
							</SelectContent>
						</Select>
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger className="w-[140px]"><SelectValue placeholder="All Status" /></SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="inactive">Inactive</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-10"> </TableHead>
							<TableHead>Name</TableHead>
							<TableHead>Role</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Joined</TableHead>
							<TableHead>Last active</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredMembers.map((m) => (
							<TableRow key={m.id}>
								<TableCell>
									<Avatar className="h-8 w-8">
										<AvatarFallback className="text-xs">{getInitials(m.name)}</AvatarFallback>
									</Avatar>
								</TableCell>
								<TableCell>
									<div className="flex flex-col">
										<span className="font-medium text-foreground">{m.name}</span>
										<span className="text-xs text-muted-foreground">{m.email}</span>
									</div>
								</TableCell>
								<TableCell>
									<Select value={m.role.toLowerCase()} onValueChange={() => {}}>
										<SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
										<SelectContent>
											<SelectItem value="owner">Owner</SelectItem>
											<SelectItem value="admin">Admin</SelectItem>
											<SelectItem value="member">Member</SelectItem>
											<SelectItem value="viewer">Viewer</SelectItem>
										</SelectContent>
									</Select>
								</TableCell>
								<TableCell>
									<StatusPill status={m.status} />
								</TableCell>
								<TableCell>{m.joined}</TableCell>
								<TableCell>{m.lastActive}</TableCell>
								<TableCell className="text-right">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="icon">
												<MoreHorizontal className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="w-40">
											<DropdownMenuLabel>Actions</DropdownMenuLabel>
											<DropdownMenuSeparator />
											<DropdownMenuItem>View activity</DropdownMenuItem>
											<DropdownMenuItem>Send message</DropdownMenuItem>
											<DropdownMenuItem>Reset MFA</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem className="text-rose-600">Remove from team</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
					<TableCaption>Showing {filteredMembers.length} of {members.length} team members</TableCaption>
				</Table>
			</div>

			<Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Invite Team Member</DialogTitle>
						<DialogDescription>Send an invitation to join your team</DialogDescription>
					</DialogHeader>
					<form onSubmit={handleInviteSubmit}>
						<div className="grid gap-4 py-4">
							<div className="grid gap-2">
								<label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
									Email Address
								</label>
								<Input
									id="email"
									type="email"
									placeholder="Enter email address"
									value={inviteEmail}
									onChange={(e) => setInviteEmail(e.target.value)}
									required
								/>
							</div>
							<div className="grid gap-2">
								<label htmlFor="role" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
									Role
								</label>
								<Select value={inviteRole} onValueChange={setInviteRole} required>
									<SelectTrigger id="role">
										<SelectValue placeholder="Select role" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="owner">Owner</SelectItem>
										<SelectItem value="admin">Admin</SelectItem>
										<SelectItem value="member">Member</SelectItem>
										<SelectItem value="viewer">Viewer</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<label htmlFor="message" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
									Personal Message (Optional)
								</label>
								<Input
									id="message"
									type="text"
									placeholder="Welcome to the team!"
									value={inviteMessage}
									onChange={(e) => setInviteMessage(e.target.value)}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button type="submit" className="w-full sm:w-auto">Send Invitation</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	)
}
