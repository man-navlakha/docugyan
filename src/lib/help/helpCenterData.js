export const helpTopics = [
  {
    slug: "getting-started",
    title: "Getting Started",
    summary: "Set up your first DocuGyan workspace in a few minutes.",
    readTime: "5 min",
    audience: "New users",
    sections: [
      {
        title: "1. Sign in or create an account",
        items: [
          "Open the login page and continue with Google or email OTP.",
          "If you signed in before, you can directly continue to your dashboard.",
        ],
      },
      {
        title: "2. Create a workspace",
        items: [
          "Use DocuAgent to provide a workspace title and optional description.",
          "Upload at least one reference file or paste reference text.",
        ],
      },
      {
        title: "3. Add a question and process",
        items: [
          "Upload one question file or paste your question as text.",
          "Start processing and wait for live status updates.",
        ],
      },
    ],
    quickLinks: [
      { label: "Open Login", href: "/login" },
      { label: "Open Dashboard", href: "/dashboard/agent" },
    ],
    relatedSlugs: ["workspaces", "uploads-and-documents"],
  },
  {
    slug: "account-and-login",
    title: "Account and Login",
    summary: "Fix sign-in, OTP, and session issues.",
    readTime: "6 min",
    audience: "All users",
    sections: [
      {
        title: "Email OTP flow",
        items: [
          "Request a code using your email and check spam/promotions folders.",
          "Use resend if the code expires or never arrives.",
        ],
      },
      {
        title: "Google sign-in flow",
        items: [
          "Use the same Google account used during previous sign-ins.",
          "If the Google popup fails, refresh the page and retry.",
        ],
      },
      {
        title: "Session behavior",
        items: [
          "The app stores short-lived access tokens and refreshes automatically.",
          "If you still see login loops, sign out and log in again.",
        ],
      },
    ],
    quickLinks: [
      { label: "Go to Login", href: "/login" },
      { label: "Contact Support", href: "/help/contact" },
    ],
    relatedSlugs: ["troubleshooting", "getting-started"],
  },
  {
    slug: "workspaces",
    title: "Workspaces and Agents",
    summary: "Create, run, and manage your DocuAgent workspaces.",
    readTime: "7 min",
    audience: "Active users",
    sections: [
      {
        title: "Create better workspaces",
        items: [
          "Use clear titles so you can identify previous runs quickly.",
          "Include context in the description for future references.",
        ],
      },
      {
        title: "Run processing",
        items: [
          "Wait for initialization and upload stages before agent execution starts.",
          "Keep the page open until redirect to workspace is complete.",
        ],
      },
      {
        title: "Monitor progress",
        items: [
          "Use workspace timeline and flow view to track each pipeline stage.",
          "Review final outputs and linked source files in the sidebar.",
        ],
      },
    ],
    quickLinks: [
      { label: "Open DocuAgent", href: "/dashboard/agent" },
      { label: "Open Dashboard", href: "/dashboard/agent" },
    ],
    relatedSlugs: ["uploads-and-documents", "results-and-exports"],
  },
  {
    slug: "uploads-and-documents",
    title: "Uploads and Documents",
    summary: "Supported formats, upload troubleshooting, and file best practices.",
    readTime: "8 min",
    audience: "All users",
    sections: [
      {
        title: "Supported formats",
        items: [
          "Reference files support PDF, TXT, MD, and image formats.",
          "Questions accept one document at a time when uploaded as file.",
        ],
      },
      {
        title: "Upload tips",
        items: [
          "Prefer clean source files with readable text and minimal noise.",
          "Split very large mixed-content documents for better extraction quality.",
        ],
      },
      {
        title: "If upload fails",
        items: [
          "Retry after confirming file extension and size are valid.",
          "Check network stability and run the upload again.",
        ],
      },
    ],
    quickLinks: [
      { label: "Open Upload Flow", href: "/dashboard/agent" },
      { label: "Open FAQ", href: "/help/faq" },
    ],
    relatedSlugs: ["workspaces", "troubleshooting"],
  },
  {
    slug: "results-and-exports",
    title: "Results and Exports",
    summary: "Understand generated outputs and how to use them effectively.",
    readTime: "6 min",
    audience: "All users",
    sections: [
      {
        title: "Where results appear",
        items: [
          "Processed outputs appear in the workspace under final answer.",
          "Reference and question sources are listed alongside the result.",
        ],
      },
      {
        title: "Quality checks",
        items: [
          "Cross-check final answers with cited reference files.",
          "If an answer misses context, rerun with clearer question scope.",
        ],
      },
      {
        title: "Sharing",
        items: [
          "Share generated outputs with teammates as part of your workflow.",
          "Keep source documents organized so outputs remain traceable.",
        ],
      },
    ],
    quickLinks: [
      { label: "Open Dashboard", href: "/dashboard/agent" },
      { label: "Troubleshooting Guide", href: "/help/troubleshooting" },
    ],
    relatedSlugs: ["workspaces", "uploads-and-documents"],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    summary: "Quick fixes for login, upload, and processing issues.",
    readTime: "9 min",
    audience: "All users",
    sections: [
      {
        title: "Login and auth issues",
        items: [
          "Clear stale browser session state by logging out and signing in again.",
          "Try incognito mode to isolate extension or cookie conflicts.",
        ],
      },
      {
        title: "Processing stalls",
        items: [
          "Confirm uploads completed before starting agent processing.",
          "Retry with smaller reference sets to isolate problematic files.",
        ],
      },
      {
        title: "Unexpected output quality",
        items: [
          "Use precise question wording and include concrete constraints.",
          "Provide higher quality reference documents and rerun.",
        ],
      },
    ],
    quickLinks: [
      { label: "Open Contact Support", href: "/help/contact" },
      { label: "Back to Help Home", href: "/help" },
    ],
    relatedSlugs: ["account-and-login", "uploads-and-documents"],
  },
];

export const faqItems = [
  {
    question: "Can non logged-in users access the help center?",
    answer: "Yes. The full help center is public, so both logged-in and logged-out users can browse it.",
  },
  {
    question: "Why am I redirected to login from dashboard links?",
    answer: "Dashboard routes require authentication. Public help routes work without login.",
  },
  {
    question: "Which files are supported for uploads?",
    answer: "PDF, TXT, MD, PNG, JPG, JPEG, WEBP, and BMP are supported in DocuAgent upload flow.",
  },
  {
    question: "Can I process without uploading files?",
    answer: "Yes. You can provide reference text and question text directly in the workspace form.",
  },
  {
    question: "How do I get faster support?",
    answer: "Share steps to reproduce, the affected workspace ID, and a short screen recording if possible.",
  },
];

export const supportChannels = [
  {
    title: "Email Support",
    detail: "support@docugyan.com",
    note: "Best for account, billing, and detailed issue reports.",
  },
  {
    title: "Help Center Routes",
    detail: "/help/*",
    note: "Use topic guides for setup, uploads, and troubleshooting.",
  },
  {
    title: "In-App Workspace Context",
    detail: "Project ID from workspace",
    note: "Include workspace/project ID in support requests for faster triage.",
  },
];

export function getHelpTopic(slug) {
  return helpTopics.find((topic) => topic.slug === slug) ?? null;
}

export function getHelpTopics() {
  return helpTopics;
}

export function getRelatedTopics(slug, limit = 3) {
  const current = getHelpTopic(slug);
  if (!current) {
    return [];
  }

  const preferred = current.relatedSlugs
    .map((relatedSlug) => getHelpTopic(relatedSlug))
    .filter(Boolean);

  const fallback = helpTopics.filter((topic) => topic.slug !== slug && !current.relatedSlugs.includes(topic.slug));
  return [...preferred, ...fallback].slice(0, limit);
}

export const helpNavigationLinks = [
  { href: "/help", label: "Overview" },
  ...helpTopics.map((topic) => ({ href: `/help/${topic.slug}`, label: topic.title })),
  { href: "/help/faq", label: "FAQ" },
  { href: "/help/contact", label: "Contact Support" },
];
