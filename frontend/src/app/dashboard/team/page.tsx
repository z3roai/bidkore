"use client"

import { useEffect, useMemo, useState } from "react"
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
import { useSession } from "next-auth/react"
import { useToast } from "@/components/ui/toast"

type Role = "owner" | "admin" | "member"

interface MemberRow {
	id: string
	name: string
	email: string
	role: Role
	status: "active" | "inactive" | "pending"
	joined: string
	lastActive?: string
	userId: string
	firstName?: string | null
	lastName?: string | null
}

interface TeamSummary { id: string; name: string; role?: Role }

interface TeamDetails {
	id: string
	name: string
	description?: string | null
	purpose?: string | null
	isActive?: boolean
	createdBy: string
	members: { id: string; userId: string; role: Role; joinedAt: string; user?: { firstName?: string | null; lastName?: string | null; email?: string | null } }[]
}

function StatusPill({ status }: { status: "Active" | "Inactive" | "Pending" }) {
	const styles =
		status === "Active"
			? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900 dark:border-emerald-800"
			: status === "Inactive"
				? "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900 dark:border-rose-800"
				: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900 dark:border-amber-800"
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

function getInitialsFromNames(firstName?: string | null, lastName?: string | null, fallback?: string): string {
    const a = (firstName ?? "").trim()
    const b = (lastName ?? "").trim()
    if (a || b) {
        return `${a.slice(0,1)}${b.slice(0,1)}`.toUpperCase()
    }
    return getInitials(fallback ?? "")
}

export default function TeamPage() {
	const { data: session } = useSession()
	const { addToast } = useToast()
	const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "")

	const [teams, setTeams] = useState<TeamSummary[]>([])
	const [currentTeamId, setCurrentTeamId] = useState<string>("")
	const [members, setMembers] = useState<MemberRow[]>([])
	const [search, setSearch] = useState("")
	const [roleFilter, setRoleFilter] = useState<string>("all")
	const [statusFilter, setStatusFilter] = useState<string>("all")
	const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
	const [inviteEmail, setInviteEmail] = useState("")
	const [inviteRole, setInviteRole] = useState<string>("")
	const [inviteMessage, setInviteMessage] = useState("")
	const [showCreateJoin, setShowCreateJoin] = useState(false)
	const [creatingTeam, setCreatingTeam] = useState(false)
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [newTeamName, setNewTeamName] = useState("")
	const [newTeamDescription, setNewTeamDescription] = useState("")
	const [newTeamPurpose, setNewTeamPurpose] = useState("")
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
	const [editTeamName, setEditTeamName] = useState("")
	const [editTeamDescription, setEditTeamDescription] = useState("")
	const [editTeamPurpose, setEditTeamPurpose] = useState("")
	const [editTeamStatus, setEditTeamStatus] = useState<boolean>(true)
	const [teamCreatedBy, setTeamCreatedBy] = useState<string>("")
	const [teamName, setTeamName] = useState<string>("")
	const isAdmin = useMemo(() => {
		const t = teams.find(t => t.id === currentTeamId)
		return t?.role === "owner" || t?.role === "admin"
	}, [teams, currentTeamId])

	const canManage = useMemo(() => {
		return isAdmin || (session?.user?.id === teamCreatedBy)
	}, [isAdmin, session?.user?.id, teamCreatedBy])

	async function notifyApiError(resp: Response, fallbackTitle: string): Promise<void> {
		let payload: unknown
		try {
			payload = await resp.json()
		} catch {
			payload = undefined
		}

		const data = (payload ?? {}) as { error?: string; message?: string; upgradeRequired?: boolean; requiredPlan?: string; currentPlan?: string }
		const status = resp.status

		if (status === 401) {
			addToast({ title: "Authentication required", description: "Please sign in and try again.", variant: "error" })
			return
		}

		if (status === 403) {
			if (data.upgradeRequired) {
				addToast({ title: "Upgrade required", description: `Requires ${data.requiredPlan ?? "enterprise"} plan.`, variant: "warning" })
				return
			}
			addToast({ title: "Permission denied", description: data.error || data.message || "You don't have permission for this action.", variant: "error" })
			return
		}

		if (status === 404) {
			addToast({ title: "Not found", description: data.error || data.message || "Requested resource was not found.", variant: "error" })
			return
		}

		if (status === 409) {
			addToast({ title: "Conflict", description: data.error || data.message || "The resource is in a conflicting state.", variant: "error" })
			return
		}

		if (status === 400) {
			addToast({ title: "Invalid request", description: data.error || data.message || "Please check your input and try again.", variant: "error" })
			return
		}

		addToast({ title: fallbackTitle, description: data.error || data.message || "Unexpected server error.", variant: "error" })
	}

	useEffect(() => {
		const loadTeams = async () => {
			if (!session?.accessToken) return
			try {
				const resp = await fetch(`${apiBase}/teams`, {
					headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken as string}` },
				})
				if (!resp.ok) throw new Error(await resp.text())
				const data = await resp.json()
				const list: TeamSummary[] = (data?.teams ?? []).map((t: any) => ({ id: t.id, name: t.name, role: (t.role?.toLowerCase?.() ?? undefined) as Role | undefined }))
				setTeams(list)
				if (list.length === 0) {
					setShowCreateJoin(true)
					setCurrentTeamId("")
					setMembers([])
				} else {
					setShowCreateJoin(false)
					setCurrentTeamId(list[0].id)
				}
			} catch (e) {
				addToast({ title: "Failed to load teams", variant: "error" })
			}
		}
		void loadTeams()
	}, [session?.accessToken, apiBase, addToast])

	useEffect(() => {
		const loadTeamDetails = async () => {
			if (!currentTeamId || !session?.accessToken) return
			try {
				const resp = await fetch(`${apiBase}/teams/${currentTeamId}`, {
					headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken as string}` },
				})
				if (!resp.ok) throw new Error(await resp.text())
				const data = (await resp.json()) as { team: TeamDetails }
				const rows: MemberRow[] = (data.team.members ?? []).map(m => ({
					id: m.id,
					userId: m.userId,
					name: `${m.user?.firstName ?? ""} ${m.user?.lastName ?? ""}`.trim() || (m.user?.email ?? m.userId),
					email: m.user?.email ?? "",
					role: (m.role?.toLowerCase?.() as Role) ?? "member",
					status: "active",
					joined: new Date(m.joinedAt).toLocaleDateString(),
					firstName: m.user?.firstName ?? "",
					lastName: m.user?.lastName ?? "",
				}))
				setMembers(rows)
				setEditTeamName(data.team.name)
				setEditTeamDescription(data.team.description ?? "")
				setEditTeamPurpose(data.team.purpose ?? "")
				setEditTeamStatus(data.team.isActive ?? true)
				setTeamCreatedBy(data.team.createdBy)
				setTeamName(data.team.name)
			} catch (e) {
				addToast({ title: "Failed to load team", variant: "error" })
			}
		}
		void loadTeamDetails()
	}, [currentTeamId, session?.accessToken, apiBase, addToast])

	const handleInviteSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!inviteEmail || !inviteRole) {
			return
		}
		if (!currentTeamId || !session?.accessToken) return
		try {
			const resp = await fetch(`${apiBase}/teams/${currentTeamId}/invite`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken as string}` },
				body: JSON.stringify({ invitations: [{ email: inviteEmail, role: inviteRole, customMessage: inviteMessage || undefined }] }),
			})
			if (resp.ok) {
				addToast({ title: "Invitation sent", variant: "success" })
			} else {
				await notifyApiError(resp, "Failed to invite")
			}
		} catch (err) {
			addToast({ title: "Network error", variant: "error" })
		}
		// Reset form and close dialog
		setInviteEmail("")
		setInviteRole("")
		setInviteMessage("")
		setIsInviteDialogOpen(false)
	}

	const handleRoleChange = async (userId: string, nextRole: Role) => {
		if (!isAdmin || !currentTeamId || !session?.accessToken) return
		const prev = members
		try {
			setMembers(members.map(m => (m.userId === userId ? { ...m, role: nextRole } : m)))
			const resp = await fetch(`${apiBase}/teams/${currentTeamId}/members/${userId}/role`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken as string}` },
				body: JSON.stringify({ role: nextRole }),
			})
			if (resp.ok) {
				addToast({ title: "Role updated", variant: "success" })
			} else {
				setMembers(prev)
				await notifyApiError(resp, "Failed to update role")
			}
		} catch (e) {
			setMembers(prev)
			addToast({ title: "Network error", variant: "error" })
		}
	}

	const handleRemoveMember = async (userId: string) => {
		if (!currentTeamId || !session?.accessToken) return
		try {
			const resp = await fetch(`${apiBase}/teams/${currentTeamId}/members/${userId}`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken as string}` },
			})
			if (resp.ok) {
				setMembers(members.filter(m => m.userId !== userId))
				addToast({ title: "Member removed", variant: "success" })
			} else {
				await notifyApiError(resp, "Failed to remove member")
			}
		} catch (e) {
			addToast({ title: "Network error", variant: "error" })
		}
	}

	const handleSendMessage = async (content: string) => {
		if (!currentTeamId || !session?.accessToken || !content.trim()) return
		try {
			const resp = await fetch(`${apiBase}/teams/${currentTeamId}/chat/messages`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken as string}` },
				body: JSON.stringify({ message: content })
			})
			if (resp.ok) addToast({ title: "Message sent", variant: "success" })
			else await notifyApiError(resp, "Failed to send message")
		} catch (e) {
			addToast({ title: "Network error", variant: "error" })
		}
	}

	const handleCreateTeam = async (name: string, description: string, purpose: string) => {
		if (!session?.accessToken) return
		try {
			setCreatingTeam(true)
			const resp = await fetch(`${apiBase}/teams`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken as string}` },
				body: JSON.stringify({ name, description: description || undefined, purpose })
			})
			setCreatingTeam(false)
			if (resp.ok) {
				addToast({ title: "Team created", variant: "success" })
				const data = await resp.json()
				setTeams([{ id: data.team.id, name: data.team.name, role: "owner" }])
				setCurrentTeamId(data.team.id)
				setShowCreateJoin(false)
				setIsCreateDialogOpen(false)
				setNewTeamName("")
				setNewTeamDescription("")
				setNewTeamPurpose("")
			} else {
				await notifyApiError(resp, "Failed to create team")
			}
		} catch (e) {
			setCreatingTeam(false)
			addToast({ title: "Network error", variant: "error" })
		}
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

				{showCreateJoin ? (
					<div className="flex flex-col items-center justify-center py-24 gap-4">
						<h2 className="text-2xl font-semibold text-foreground">You are not part of any team</h2>
						<p className="text-muted-foreground">Create a team to get started.</p>
						<div className="flex items-center gap-3">
							<Button variant="secondary" className="w-full" onClick={() => setIsCreateDialogOpen(true)} disabled={creatingTeam}>{creatingTeam ? "Creating..." : "Create Team"}</Button>
						</div>
					</div>
				) : (
					<>
						<div className="mb-6 flex items-center justify-between">
							<div>
								<h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1">{teamName ? teamName : "Untitled"}'s Team</h1>
								<p className="text-muted-foreground">Manage your team members and their permissions.</p>
							</div>
							<div className="flex items-center gap-2">
								<Button variant="secondary" className="gap-2" onClick={() => setIsInviteDialogOpen(true)} disabled={!canManage}>
									<Users className="h-4 w-4" /> Invite Members
								</Button>
								{session?.user?.id === teamCreatedBy && (
									<Button variant="secondary" className="gap-2 ml-2" onClick={() => setIsEditDialogOpen(true)}>Edit Team</Button>
								)}
							</div>
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
												<AvatarFallback className="text-xs bg-secondary text-secondary-foreground">{getInitialsFromNames(m.firstName, m.lastName, m.name)}</AvatarFallback>
											</Avatar>
										</TableCell>
										<TableCell>
											<div className="flex flex-col">
												<span className="font-medium text-foreground">{m.name}</span>
												<span className="text-xs text-muted-foreground">{m.email}</span>
											</div>
										</TableCell>
										<TableCell>
											<Select value={m.role} onValueChange={(v) => handleRoleChange(m.userId, v as any)} disabled={!isAdmin}>
												<SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
												<SelectContent>
													<SelectItem value="owner">Owner</SelectItem>
													<SelectItem value="admin">Admin</SelectItem>
													<SelectItem value="member">Member</SelectItem>
												</SelectContent>
											</Select>
										</TableCell>
										<TableCell>
											<StatusPill status={m.status === "active" ? "Active" : m.status === "inactive" ? "Inactive" : "Pending"} />
										</TableCell>
										<TableCell>{m.joined}</TableCell>
										<TableCell>{m.lastActive ?? ""}</TableCell>
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
													<DropdownMenuItem onClick={() => {
														const content = window.prompt("Message")?.trim() ?? ""
														if (content) void handleSendMessage(content)
													}}>Send message</DropdownMenuItem>
													<DropdownMenuItem>Reset MFA</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem className="text-rose-600" disabled={!isAdmin && m.userId !== (session?.user?.id ?? "")} onClick={() => handleRemoveMember(m.userId)}>
														Remove from team
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
							<TableCaption>Showing {filteredMembers.length} of {members.length} team members</TableCaption>
						</Table>
					</>
				)}
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

			{/* Create Team Dialog */}
			<Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
				<DialogContent className="sm:max-w-[520px]">
					<DialogHeader>
						<DialogTitle>Create Team</DialogTitle>
						<DialogDescription>Enter team details to create a new team.</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault()
							if (!newTeamName.trim() || !newTeamPurpose.trim()) {
								addToast({ title: "Name and purpose are required", variant: "error" })
								return
							}
							void handleCreateTeam(newTeamName.trim(), newTeamDescription.trim(), newTeamPurpose.trim())
						}}
					>
						<div className="grid gap-4 py-4">
							<div className="grid gap-2">
								<label htmlFor="team-name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
									Team Name
								</label>
								<Input
									id="team-name"
									placeholder="e.g., Acme Gov Team"
									value={newTeamName}
									onChange={(e) => setNewTeamName(e.target.value)}
									required
								/>
							</div>
							<div className="grid gap-2">
								<label htmlFor="team-purpose" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
									Purpose
								</label>
								<Input
									id="team-purpose"
									placeholder="e.g., Collaboration on proposals"
									value={newTeamPurpose}
									onChange={(e) => setNewTeamPurpose(e.target.value)}
									required
								/>
							</div>
							<div className="grid gap-2">
								<label htmlFor="team-description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
									Description (optional)
								</label>
								<Input
									id="team-description"
									placeholder="Short description"
									value={newTeamDescription}
									onChange={(e) => setNewTeamDescription(e.target.value)}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button type="submit" className="w-full sm:w-auto" disabled={creatingTeam}>
								{creatingTeam ? "Creating..." : "Create Team"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Edit Team Dialog (creator only) */}
			<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
				<DialogContent className="sm:max-w-[520px]">
					<DialogHeader>
						<DialogTitle>Edit Team</DialogTitle>
						<DialogDescription>Update team information and status.</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault()
							if (!editTeamName.trim() || !editTeamPurpose.trim()) {
								addToast({ title: "Name and purpose are required", variant: "error" })
								return
							}
							void (async () => {
								if (!session?.accessToken || !currentTeamId) return
								const resp = await fetch(`${apiBase}/teams/${currentTeamId}`, {
									method: "PUT",
									headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken as string}` },
									body: JSON.stringify({ name: editTeamName.trim(), description: editTeamDescription.trim() || undefined, purpose: editTeamPurpose.trim(), isActive: editTeamStatus })
								})
								if (resp.ok) {
									addToast({ title: "Team updated", variant: "success" })
									setTeams(teams.map(t => t.id === currentTeamId ? { ...t, name: editTeamName.trim() } : t))
									setIsEditDialogOpen(false)
								} else {
									await notifyApiError(resp, "Failed to update team")
								}
							})()
						}}
					>
						<div className="grid gap-4 py-4">
							<div className="grid gap-2">
								<label htmlFor="edit-team-name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
									Team Name
								</label>
								<Input id="edit-team-name" value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} required />
							</div>
							<div className="grid gap-2">
								<label htmlFor="edit-team-purpose" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
									Purpose
								</label>
								<Input id="edit-team-purpose" value={editTeamPurpose} onChange={(e) => setEditTeamPurpose(e.target.value)} required />
							</div>
							<div className="grid gap-2">
								<label htmlFor="edit-team-description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
									Description (optional)
								</label>
								<Input id="edit-team-description" value={editTeamDescription} onChange={(e) => setEditTeamDescription(e.target.value)} />
							</div>
							<div className="grid gap-2">
								<label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
									Status
								</label>
								<Select value={editTeamStatus ? "active" : "inactive"} onValueChange={(v) => setEditTeamStatus(v === "active")}>
									<SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
									<SelectContent>
										<SelectItem value="active">Active</SelectItem>
										<SelectItem value="inactive">Inactive</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<DialogFooter>
							<Button type="submit" className="w-full sm:w-auto" disabled={creatingTeam}>Save Changes</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	)
}
