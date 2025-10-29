import calendarSchedulingService from "@/services/calendarSchedulingService";

/**
 * Test script to demonstrate calendar scheduling functionality
 * This script shows how opportunities with deadlines automatically get calendar events created
 */

async function testCalendarScheduling() {
	console.log("🗓️  Testing Calendar Scheduling for Saved Opportunities");
	console.log("=".repeat(60));

	// Mock opportunity data (similar to what would come from SAM.gov)
	const mockOpportunity = {
		id: "test-opportunity-123",
		noticeId: "TEST-2024-001",
		title: "IT Services for Federal Agency - Test Opportunity",
		responseDeadLine: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
		fullParentPathName: "Department of Test Services",
		uiLink: "https://sam.gov/opp/TEST-2024-001",
		description:
			"This is a test opportunity for IT services including cloud infrastructure, cybersecurity, and software development support.",
	};

	// Mock user ID (in real scenario, this would be the authenticated user)
	const testUserId = "test-user-123";

	console.log("📋 Test Opportunity Details:");
	console.log(`   Notice ID: ${mockOpportunity.noticeId}`);
	console.log(`   Title: ${mockOpportunity.title}`);
	console.log(`   Agency: ${mockOpportunity.fullParentPathName}`);
	console.log(`   Deadline: ${mockOpportunity.responseDeadLine.toISOString()}`);
	console.log("");

	try {
		console.log("🔄 Attempting to create calendar event...");

		const result =
			await calendarSchedulingService.createOpportunityDeadlineEvent(
				testUserId,
				mockOpportunity
			);

		if (result.success) {
			console.log("✅ Calendar event created successfully!");
			console.log(`   Event ID: ${result.eventId}`);

			// Record the calendar event
			if (result.eventId) {
				await calendarSchedulingService.recordCalendarEvent(
					testUserId,
					mockOpportunity.id,
					result.eventId
				);
				console.log("📝 Calendar event recorded in system");
			}
		} else {
			console.log("❌ Calendar event creation failed:");
			console.log(`   Reason: ${result.error}`);

			// Common reasons for failure:
			if (result.error?.includes("Microsoft integration not available")) {
				console.log("");
				console.log(
					"💡 This is expected if the user hasn't connected their Microsoft account."
				);
				console.log("   Users need to:");
				console.log("   1. Go to Settings → Integrations");
				console.log("   2. Connect their Microsoft account");
				console.log("   3. Grant calendar permissions");
			}
		}
	} catch (error) {
		console.error("💥 Error during calendar scheduling test:", error);
	}

	console.log("");
	console.log("🔍 How the Calendar Scheduling Works:");
	console.log("=".repeat(60));
	console.log(
		"1. When a user saves an opportunity (via /api/opportunities/save)"
	);
	console.log(
		"2. The system checks if the opportunity has a response deadline"
	);
	console.log("3. If the user has Microsoft integration enabled:");
	console.log("   - Creates a calendar event 2 hours before the deadline");
	console.log("   - Sets the event to end at the exact deadline time");
	console.log("   - Includes opportunity details in the event description");
	console.log("   - Sets a 1-hour reminder notification");
	console.log("4. The calendar event includes:");
	console.log("   - Direct link to the opportunity on SAM.gov");
	console.log("   - Opportunity details (Notice ID, Agency, Description)");
	console.log("   - Action items checklist");
	console.log("   - Professional formatting with BidKore branding");
	console.log("");

	console.log("🤖 Automatic Scheduling via Poller:");
	console.log("=".repeat(60));
	console.log("1. The SAM.gov poller runs every 15 minutes");
	console.log(
		"2. When new opportunities are discovered that match user filters"
	);
	console.log(
		"3. Calendar events are automatically created for opportunities with deadlines"
	);
	console.log("4. Users get both email notifications AND calendar events");
	console.log("5. No manual action required - fully automated workflow");
	console.log("");

	console.log("✨ Test completed!");
}

// Run the test if this script is executed directly
if (require.main === module) {
	testCalendarScheduling()
		.then(() => {
			console.log("Test script finished successfully");
			process.exit(0);
		})
		.catch(error => {
			console.error("Test script failed:", error);
			process.exit(1);
		});
}

export { testCalendarScheduling };
