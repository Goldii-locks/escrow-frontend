#94 Implement pagination and search filters on the Job Dashboard
Repo Avatar
Goldii-locks/escrow-frontend
Problem & Goal
Currently, the Job Dashboard (app/dashboard/page.tsx) is designed around displaying a single active job. However, the backend endpoint GET /api/jobs/by-wallet/:address returns a paginated list of job summaries that the address is associated with. When a user has multiple active jobs or acts in different roles (Client on one job, Freelancer on another), they cannot navigate through them or filter the view. The goal is to build list pagination and role filter tabs.

Context & Components
Target Repository: escrow-frontend
Module/Component: app/dashboard/page.tsx
Implementation Details
Refactor the dashboard state to store an array of jobs and query statistics (page, limit, total).
Render filter tabs: "All", "As Client", "As Freelancer", "As Arbiter" above the list, which filter results or pass filters to the API call.
Render pagination controls (Previous/Next buttons, active page indicators) that trigger API fetches with ?page=X&limit=Y.
Render a contract search bar to query a specific job ID directly.
Make individual job list entries collapsible/expandable so that clicking an entry retrieves and displays its detailed milestone list.
Verification & Testing Requirements
Validation check: Connect a wallet that has multiple active jobs associated with it. Verify that the dashboard displays the paginated list, the "Client" filter only displays jobs where the address is client, and clicking "Next" loads the subsequent page of jobs.

#91 Migrate Wallet Connection to Stellar Wallets Kit for multi-wallet support (Freighter, Albedo, xBull, Hana)
Repo Avatar
Goldii-locks/escrow-frontend
Problem & Goal
Currently, the application (WalletContext.tsx) directly accesses the global (window as any).freighter object. This locks the application into a single wallet provider (Freighter) and relies on fragile global injection timing. The @creit.tech/stellar-wallets-kit package is already listed in package.json dependencies but is not imported or used. The goal is to refactor the wallet connection interface to use the Stellar Wallets Kit, offering support for Freighter, Albedo, xBull, and Hana wallets.

Context & Components
Target Repository: escrow-frontend
Module/Component: app/context/WalletContext.tsx, app/components/Navbar.tsx
Implementation Details
Import StellarWalletsKit and associated constants (e.g. SUPPORTED_WALLETS) from @creit.tech/stellar-wallets-kit.
Re-implement the connect() function in WalletProvider to instantiate the kit and invoke the modal/prompt to allow users to select their wallet provider.
Update transaction signing helper (signTransaction) to request transaction signing through the selected wallet kit instance.
Refactor Navbar.tsx to support selection UI or triggers provided by the wallet kit configuration.
Verification & Testing Requirements
Validation check: Click "Connect Wallet" on the frontend. A modal should pop up listing multiple wallets (Freighter, Albedo, xBull, etc.). Selecting Albedo or Freighter should prompt that extension to request connection, successfully loading the public address on approval.



#93 Setup Unit Testing framework (Jest + React Testing Library) and add core component tests
Repo Avatar
Goldii-locks/escrow-frontend
Problem & Goal
The frontend application lacks a unit testing framework, which makes components prone to silent regressions during updates or refactoring. Core UI elements like the Navbar (which coordinates wallet context logic) and the MilestoneCard (which handles role-based buttons like Approve/Dispute/Mark Delivered) need validation to guarantee visual and state accuracy. The goal is to configure Jest, React Testing Library, and write initial tests.

Context & Components
Target Repository: escrow-frontend
Module/Component: package.json, new __tests__/ directory
Implementation Details
Install testing devDependencies: jest, @testing-library/react, @testing-library/dom, @testing-library/jest-dom, jest-environment-jsdom, and typescript transform configurations.
Configure jest.config.ts to support Next.js compilation settings and ts-path mappings.
Write unit tests for app/components/Navbar.tsx:
Verify that when no wallet is connected, the "Connect Wallet" button renders.
Verify that when a wallet address is active, the dashboard link and the shortened address badge render.
Write unit tests for app/components/MilestoneCard.tsx:
Verify that only the Freelancer sees the "Mark Delivered" button when status is Pending.
Verify that only the Client sees the "Approve" button when status is Delivered.
Verify that the correct status color classes are mapped.
Verification & Testing Requirements
Validation check: Run npm run test (or npm test) and verify that all test suites pass successfully and generate a basic code coverage report.


#92 Implement automatic conversion and formatted display of Stroops to Lumens (XLM) on UI dashboard and creation forms
Repo Avatar
Goldii-locks/escrow-frontend
Problem & Goal
Currently, the Create Job form (app/create/page.tsx) expects users to enter milestone values in raw "stroops" (e.g. 10000000 for 1 XLM), and the Dashboard (MilestoneCard.tsx) displays raw stroop values. Entering and reading raw stroops is extremely non-intuitive for users and increases the risk of financial input errors. The goal is to accept user inputs in standard decimal units (like XLM) in the creation form and convert them to stroops under the hood, as well as formatting milestone displays on the dashboard.

Context & Components
Target Repository: escrow-frontend
Module/Component: app/create/page.tsx (Create Job Form), app/components/MilestoneCard.tsx
Implementation Details
Update input labels and placeholders in app/create/page.tsx to indicate XLM/decimal token amounts.
In the form submission handler, multiply decimal inputs by 10,000,000 (10^7, representing the stroop conversion factor) and convert to a BigInt string before building the contract payload.
In app/components/MilestoneCard.tsx, divide the raw stroops amount from the job model by 10,000,000 to display standard decimal amounts (e.g., displaying "5.5 XLM" instead of "55000000 stroops").
Add support for dynamic token decimal configurations if a non-XLM token is specified.
Verification & Testing Requirements
Validation check: Open the Create Job form. Type "2.5" in the milestone amount field. Verify that the built transaction args pass a value of "25000000" (stroops) to the backend API. Verify that a milestone with "50000000" stroops is displayed as "5 XLM" on the dashboard card.

