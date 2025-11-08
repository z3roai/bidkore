"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Filter as FilterIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface TeamFilterProps {
	roleFilter: string
	statusFilter: string
	onRoleFilterChange: (value: string) => void
	onStatusFilterChange: (value: string) => void
	onClearFilters: () => void
}

export default function TeamFilter({
	roleFilter,
	statusFilter,
	onRoleFilterChange,
	onStatusFilterChange,
	onClearFilters,
}: TeamFilterProps) {
	const hasActiveFilters = roleFilter !== "all" || statusFilter !== "all"

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className={cn("gap-2", hasActiveFilters && "border-primary bg-primary/5")}
				>
					<FilterIcon className="h-4 w-4" />
					Filter
					{hasActiveFilters && (
						<span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
							{(roleFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)}
						</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-64 p-4">
				<DropdownMenuLabel className="px-0">Filter Team Members</DropdownMenuLabel>
				<DropdownMenuSeparator className="my-3" />
				<div className="space-y-4">
					<div className="space-y-2">
						<label className="text-sm font-medium text-foreground">Role</label>
						<Select value={roleFilter} onValueChange={onRoleFilterChange}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All Roles" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Roles</SelectItem>
								<SelectItem value="owner">Owner</SelectItem>
								<SelectItem value="admin">Admin</SelectItem>
								<SelectItem value="member">Member</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium text-foreground">Status</label>
						<Select value={statusFilter} onValueChange={onStatusFilterChange}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="inactive">Inactive</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{hasActiveFilters && (
						<>
							<DropdownMenuSeparator className="my-3" />
							<Button
								variant="ghost"
								size="sm"
								className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
								onClick={onClearFilters}
							>
								<X className="h-4 w-4" />
								Clear all filters
							</Button>
						</>
					)}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

