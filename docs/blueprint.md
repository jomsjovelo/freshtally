# **App Name**: FreshTally

## Core Features:

- Dashboard Analytics: Display real-time revenue, expense, and sales performance metrics, offering a quick overview of the business health.
- Point of Sale (POS): Facilitate fast and accurate transaction processing, including item scanning, custom product entry, and payment handling.
- Inventory Management: Track product stock levels, manage product details (pricing, description), and generate automated low-stock alerts.
- Tenant-Scoped Settings: Allow store owners to manage general settings for their specific tenancy, including user roles (owner/staff) and basic preferences.
- Secure User Authentication: Enable secure user login with tenant identification and role-based access control, ensuring appropriate permissions for owners and staff.
- Multi-Tenant Data Separation: Implement a Firestore schema where all operational collections (users, products, transactions, expenses, inventory) include a 'tenantId' field for strict data isolation.
- AI-Powered Expense Categorization Tool: Utilize an AI tool to automatically categorize business expenses based on provided descriptions or receipt details, streamlining financial tracking.

## Style Guidelines:

- Primary color: A calm, professional blue (#2979A3), signaling trust and efficiency for a business management system. (HSL: 200, 60%, 40%)
- Background color: A subtly cool off-white (#F6FAFC), providing a clean, breathable canvas for data-heavy views and preventing eye strain. (HSL: 200, 15%, 98%)
- Accent color: A rich purple (#7540BF), offering a sophisticated contrast to draw attention to calls-to-action and key interactive elements. (HSL: 260, 50%, 50%)
- Headline and Body font: 'Inter' (sans-serif) for its modern, neutral, and highly readable qualities, crucial for data display and navigation.
- Use clear, intuitive system icons following Material Design 3 principles, opting for filled variants for key actions and outlined for supporting functions.
- Main layout: Fixed bottom navigation bar with 4 core icons (Dashboard, POS, Inventory, Settings). The entire application content is wrapped in a container with 'max-w-md mx-auto min-h-screen bg-gray-50 pb-16' for a mobile-first viewport.
- Interactive elements: All buttons, list items, and input fields must maintain a minimum height of 48px to adhere to touch standards. Data entry uses full-screen slide-up modals.
- Date Component Standard: Implement the 'Syncros V18' standard using React-Day-Picker v9, featuring a 7-column 40px grid, font-weight 300 for dates, and high-contrast primary selection with a double-ring focus state.
- Animations: Employ subtle, functional animations for state changes, navigation transitions, and feedback, aligning with Material Design 3 principles for meaningful motion.