// Mock data for new dashboard design
export interface MetricData {
  icon: string;
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative";
}

export interface TCVData {
  period: string;
  value: number;
  isHighlighted?: boolean;
}

export type TimePeriod = "daily" | "monthly" | "yearly";

export interface ActivityItem {
  icon: string;
  description: string;
}

export interface OpportunityData {
  type: string;
  title: string;
  status: string;
  description: string;
  documents: number;
  dueDate: string;
}

export interface EventItem {
  title: string;
  time: string;
}

export interface DepartmentData {
  name: string;
  value: number;
}

export interface AverageContractPriceData {
  month: string;
  price: number;
}

// Key metrics data
export const keyMetrics: MetricData[] = [
  {
    icon: "🚀",
    title: "New Opportunities",
    value: "112",
    change: "+21% vs Last Week",
    changeType: "positive",
  },
  {
    icon: "📄",
    title: "Proposals",
    value: "8",
    change: "+50% vs Last Week",
    changeType: "positive",
  },
  {
    icon: "📅",
    title: "Due 30+ Days",
    value: "67",
    change: "-9% vs Last Week",
    changeType: "negative",
  },
  {
    icon: "🎯",
    title: "Win Rate",
    value: "18%",
    change: "+14% vs Last Month",
    changeType: "positive",
  },
  {
    icon: "💰",
    title: "TCV",
    value: "180.6M",
    change: "+9% vs Last Week",
    changeType: "positive",
  },
];

// TCV Overview data for different time periods
export const tcvOverviewData: Record<TimePeriod, TCVData[]> = {
  daily: [
    { period: "Mon", value: 6.2 },
    { period: "Tue", value: 7.1 },
    { period: "Wed", value: 5.8 },
    { period: "Thu", value: 8.3 },
    { period: "Fri", value: 7.9 },
    { period: "Sat", value: 4.2 },
    { period: "Sun", value: 3.1, isHighlighted: true },
  ],
  monthly: [
    { period: "Jan", value: 150 },
    { period: "Feb", value: 165 },
    { period: "Mar", value: 140 },
    { period: "Apr", value: 175 },
    { period: "May", value: 190 },
    { period: "Jun", value: 160 },
    { period: "Jul", value: 185 },
    { period: "Aug", value: 190, isHighlighted: true },
    { period: "Sep", value: 170 },
    { period: "Oct", value: 180 },
    { period: "Nov", value: 182 },
  ],
  yearly: [
    { period: "2020", value: 1200 },
    { period: "2021", value: 1350 },
    { period: "2022", value: 1420 },
    { period: "2023", value: 1580 },
    { period: "2024", value: 1680, isHighlighted: true },
    { period: "2025", value: 1820 },
  ],
};

// Recent Activity data
export const recentActivity: ActivityItem[] = [
  {
    icon: "",
    description: 'Draft proposal "IT Support Contract" updated by Sarah L.',
  },
  {
    icon: "",
    description:
      'Bidkore detected missing compliance clauses in "Medical Equipment Supply"',
  },
  {
    icon: "",
    description:
      'Payment milestone completed: 40% disbursed for "Highway Expansion Plan"',
  },
  {
    icon: "",
    description:
      'Compliance review completed: No issues detected in "Bridge Repair RFQ"',
  },
  {
    icon: "",
    description:
      'Compliance review completed: No issues detected in "Bridge Repair RFQ"',
  },
  {
    icon: "",
    description:
      'Compliance review completed: No issues detected in "Bridge Repair RFQ"',
  },
  {
    icon: "",
    description:
      'Compliance review completed: No issues detected in "Bridge Repair RFQ"',
  },
];

// Best Match Opportunity data
export const bestMatchOpportunity: OpportunityData = {
  type: "SDVOSB Set-Aside",
  title: "Federal Facility Energy Retrofit Contract",
  status: "Active",
  description:
    "The Department of Energy seeks a qualified vendor to retrofit existing federal buildings with energy-efficient systems, including HVAC upgrades, solar integration, and lighting modernization.",
  documents: 3,
  dueDate: "Oct. 31, 2025",
};

// Upcoming Events data
export const upcomingEvents: EventItem[] = [
  {
    title: "Proposal due BLM",
    time: "Today 5:00 PM",
  },
  {
    title: "Site Visit - VA Clinic",
    time: "Today 6:00 PM",
  },
  {
    title: "RFP Q&A closes",
    time: "Mon 2:00 PM",
  },
  {
    title: "Proposal due - Bridge Repair RFQ",
    time: "Fri 2:00 AM",
  },
  {
    title: "Proposal due - Bridge Repair RFQ",
    time: "Fri 2:00 AM",
  },
];

// Department data for horizontal bar chart
export const departmentData: DepartmentData[] = [
  { name: "Defense", value: 145 },
  { name: "Energy", value: 128 },
  { name: "Transportation", value: 112 },
  { name: "Health", value: 98 },
  { name: "Education", value: 87 },
  { name: "Agriculture", value: 76 },
  { name: "Commerce", value: 65 },
];

// Average contract price data for line chart
export const averageContractPriceData: AverageContractPriceData[] = [
  { month: "Jan", price: 125 },
  { month: "Feb", price: 132 },
  { month: "Mar", price: 118 },
  { month: "Apr", price: 145 },
  { month: "May", price: 158 },
  { month: "Jun", price: 142 },
  { month: "Jul", price: 167 },
  { month: "Aug", price: 174 },
  { month: "Sep", price: 159 },
  { month: "Oct", price: 183 },
  { month: "Nov", price: 176 },
  { month: "Dec", price: 191 },
];

// Smart Alerts data interfaces
export interface SmartAlert {
  id: string;
  contract: string;
  status: "Active" | "Paused";
  interval: "Daily" | "Weekly" | "Real-time" | string;
  dueDate: string;
  // Additional fields used by Smart Alerts page UI
  lastTriggered?: string;
  tags?: string[];
}

// Smart Alerts mock data
export const smartAlerts: SmartAlert[] = [
  {
    id: "1",
    contract: "DoD Cloud Infrastructure",
    status: "Active",
    interval: "Daily",
    dueDate: "12/08/2026",
    lastTriggered: "2 hours ago",
    tags: ["Cloud", "Infrastructure", "DoD"],
  },
  {
    id: "2",
    contract: "GSA Cybersecurity Services",
    status: "Active",
    interval: "Real-time",
    dueDate: "12/08/2026",
    lastTriggered: "1 day ago",
    tags: ["Cybersecurity", "Security Assessment"],
  },
  {
    id: "3",
    contract: "VA IT Modernization",
    status: "Paused",
    interval: "Weekly",
    dueDate: "12/08/2026",
    lastTriggered: "5 days ago",
    tags: ["IT Services", "Modernization", "VA"],
  },
  {
    id: "4",
    contract: "Data Analytics Projects",
    status: "Active",
    interval: "Daily",
    dueDate: "12/08/2026",
    lastTriggered: "3 hours ago",
    tags: ["Data Analytics", "AI", "Machine Learning"],
  },
];

// Suggested Smart Alerts (for right sidebar)
export interface SuggestedSmartAlert {
  id: string;
  title: string;
  subtitle: string;
}

export const suggestedSmartAlerts: SuggestedSmartAlert[] = [
  {
    id: "s1",
    title: "GSA Multiple Award Schedules",
    subtitle: "Based on your profile and past wins",
  },
  {
    id: "s2",
    title: "VA Healthcare IT",
    subtitle: "High match rate with your capabilities",
  },
  {
    id: "s3",
    title: "DoD Cybersecurity",
    subtitle: "Growing opportunity in your region",
  },
];

// Smart Alerts statistics (for right sidebar)
export const smartAlertStats = {
  totalAlerts: 4,
  active: 3,
  triggeredToday: 8,
};

// Pipeline Kanban data interfaces
export interface PipelineColumn {
  id: string;
  name: string;
  color: string;
}

export interface PipelineCard {
  id: string;
  name: string;
  column: string;
  program?: string;
  dueDate?: Date;
  status?: "active" | "inactive";
  location?: string;
  documents?: number;
  department?: string;
  tcv?: number;
}

// Pipeline columns
export const pipelineColumns: PipelineColumn[] = [
  { id: "proposal", name: "Proposal", color: "#8B5CF6" },
  { id: "final-review", name: "Final Review", color: "#F59E0B" },
  { id: "submitted", name: "Submitted", color: "#3183FF" },
  { id: "won", name: "Won", color: "#10B981" },
];

// Pipeline cards mock data
export const pipelineCards: PipelineCard[] = [
  // Proposal column cards
  {
    id: "1",
    name: "Waste Management - VA Hospital",
    column: "proposal",
    program: "SDVOSB Set-Aside",
    dueDate: new Date("2026-08-02"),
    status: "active",
    location: "Knoxville, TN",
    documents: 3,
    department: "Dept. of Defense",
    tcv: 6.65,
  },
  {
    id: "2",
    name: "Waste Management - VA Hospital",
    column: "proposal",
    program: "SDVOSB Set-Aside",
    dueDate: new Date("2026-08-02"),
    status: "active",
    location: "Knoxville, TN",
    documents: 3,
    department: "Dept. of Defense",
    tcv: 6.65,
  },
  // Final Review column cards
  {
    id: "3",
    name: "Waste Management - VA Hospital",
    column: "final-review",
    program: "SDVOSB Set-Aside",
    dueDate: new Date("2026-08-02"),
    status: "active",
    location: "Knoxville, TN",
    documents: 3,
    department: "Dept. of Defense",
    tcv: 6.65,
  },
  {
    id: "4",
    name: "Waste Management - VA Hospital",
    column: "final-review",
    program: "SDVOSB Set-Aside",
    dueDate: new Date("2026-08-02"),
    status: "active",
    location: "Knoxville, TN",
    documents: 3,
    department: "Dept. of Defense",
    tcv: 6.65,
  },
  {
    id: "5",
    name: "Waste Management - VA Hospital",
    column: "final-review",
    program: "SDVOSB Set-Aside",
    dueDate: new Date("2026-08-02"),
    status: "active",
    location: "Knoxville, TN",
    documents: 3,
    department: "Dept. of Defense",
    tcv: 6.65,
  },
  // Submitted column cards
  {
    id: "6",
    name: "Waste Management - VA Hospital",
    column: "submitted",
    program: "SDVOSB Set-Aside",
    status: "active",
    location: "Knoxville, TN",
    documents: 3,
    department: "Dept. of Defense",
    tcv: 6.65,
  },
  {
    id: "7",
    name: "Waste Management - VA Hospital",
    column: "submitted",
    program: "SDVOSB Set-Aside",
    status: "active",
    location: "Knoxville, TN",
    documents: 3,
    department: "Dept. of Defense",
    tcv: 6.65,
  },
  // Won column cards
  {
    id: "8",
    name: "Waste Management - VA Hospital",
    column: "won",
    program: "SDVOSB Set-Aside",
    status: "active",
    location: "Knoxville, TN",
    documents: 3,
    department: "Dept. of Defense",
    tcv: 6.65,
  },
  {
    id: "9",
    name: "Waste Management - VA Hospital",
    column: "won",
    program: "SDVOSB Set-Aside",
    status: "inactive",
    location: "Knoxville, TN",
    documents: 3,
    department: "Dept. of Defense",
    tcv: 6.65,
  },
];

// AI Search Opportunities mock data
export interface AISearchOpportunity {
  id: string | null;
  samId: string;
  noticeId: string;
  title: string;
  description: string;
  agency: string;
  naicsCode?: string;
  classificationCode?: string;
  postedDate?: string;
  responseDeadline?: string;
  setAside?: string;
  location: string;
  estimatedValue?: number | null;
  uiLink?: string;
  score?: number;
  whyRanked?: string[];
  probabilityOfSuccess?: number;
  bidability?: string;
  winRate?: number;
  assistantAnalysis?: string[];
  assistantAdvice?: string;
}

export const mockAISearchOpportunities: AISearchOpportunity[] = [
  {
    id: null,
    samId: "HT940825PE005",
    noticeId: "HT940825PE005",
    title: "Cloud Infrastructure Modernization",
    description:
      "The Department of Defense seeks qualified contractors to provide comprehensive cloud infrastructure modernization services. This project involves migrating legacy systems to a secure, scalable cloud environment while ensuring compliance with federal security standards and regulations. The Contractor shall provide cloud infrastructure modernization services to the 47th Medical Group (47 MDG), located at Laughlin Air Force Base (LAFB) in accordance with the Statement of Work (SOW), all contract requirements, and compliance with federal, state, and local regulations. The scope includes assessment of current infrastructure, development of migration strategies, implementation of cloud solutions, and ongoing support and maintenance.",
    agency: "Department of Defense (DoD) / DEPT OF THE AIR FORCE",
    naicsCode: "518210",
    classificationCode: "D209",
    postedDate: new Date("2025-04-01").toISOString(),
    responseDeadline: new Date("2025-05-15").toISOString(),
    setAside: "RFP",
    location: "Laughlin Air Force Base, TX",
    estimatedValue: 2500000,
    uiLink: "https://sam.gov/opp/HT940825PE005",
    score: 0.85,
    whyRanked: [
      "Strong match with cloud infrastructure requirements",
      "Favorable set-aside category",
    ],
    probabilityOfSuccess: 72,
    bidability: "High",
    winRate: 72,
    assistantAnalysis: [
      "Strong alignment with cloud modernization needs",
      "DoD has consistent spending in this area",
    ],
    assistantAdvice:
      "This opportunity is ideal for small businesses with cloud migration expertise. The DoD is seeking a contractor to modernize their infrastructure with emphasis on security compliance (FedRAMP, NIST 800-53). Key requirements include AWS/Azure experience, DevSecOps capabilities, and prior federal contract experience. The estimated timeline is 18-24 months with potential for extensions.",
  },
  {
    id: null,
    samId: "DHS940825PE006",
    noticeId: "DHS940825PE006",
    title: "Cybersecurity Assessment Services",
    description:
      "The Contractor shall provide comprehensive cybersecurity assessment and penetration testing services for critical infrastructure systems in accordance with NIST guidelines and federal security standards.",
    agency: "Department of Homeland Security / CYBERSECURITY AND INFRASTRUCTURE SECURITY AGENCY",
    naicsCode: "541512",
    classificationCode: "R425",
    postedDate: new Date("2025-04-10").toISOString(),
    responseDeadline: new Date("2025-04-30").toISOString(),
    setAside: "RFQ",
    location: "Washington, DC",
    estimatedValue: 1800000,
    uiLink: "https://sam.gov/opp/DHS940825PE006",
    score: 0.78,
    whyRanked: [
      "High demand for cybersecurity services",
      "CISA is a key agency for security contracts",
    ],
    probabilityOfSuccess: 68,
    bidability: "High",
    winRate: 68,
    assistantAnalysis: [
      "Critical infrastructure focus aligns with current priorities",
      "NIST compliance is essential",
    ],
    assistantAdvice:
      "Showcase NIST 800-53 expertise • Provide examples of critical infrastructure assessments • Highlight incident response capabilities",
  },
  {
    id: null,
    samId: "GSA940825PE007",
    noticeId: "GSA940825PE007",
    title: "Data Analytics Platform Development",
    description:
      "The Contractor shall design, develop, and implement a scalable data analytics platform to support federal agency decision-making processes, including data visualization, reporting, and predictive analytics capabilities.",
    agency: "GSA / FEDERAL ACQUISITION SERVICE",
    naicsCode: "541511",
    classificationCode: "D307",
    postedDate: new Date("2025-05-01").toISOString(),
    responseDeadline: new Date("2025-06-10").toISOString(),
    setAside: "RFP",
    location: "Washington, DC",
    estimatedValue: 3200000,
    uiLink: "https://sam.gov/opp/GSA940825PE007",
    score: 0.82,
    whyRanked: [
      "GSA has strong track record with data analytics projects",
      "Scalable platform requirement matches your capabilities",
    ],
    probabilityOfSuccess: 75,
    bidability: "High",
    winRate: 75,
    assistantAnalysis: [
      "GSA values innovation in data analytics",
      "Multi-agency potential increases value",
    ],
    assistantAdvice:
      "Demonstrate scalability with past projects • Include predictive analytics case studies • Show integration with existing federal systems",
  },
];