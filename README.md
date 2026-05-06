# FreshTally - Cloud Store Ledger

FreshTally is a high-performance, AI-powered multi-tenant business management system. It provides store owners and staff with a secure, professional "Terminal" for real-time retail operations.

## GitHub & Antigravity Migration
To move this project to GitHub or Antigravity, follow these steps:

1. **Initialize Git**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit from FreshTally Studio"
   ```

2. **Create a Remote Repository**: Create a new repository on GitHub or Antigravity.

3. **Push to Remote**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

## Technical Features
- **Atomic Identity Handshake**: Chained Firestore listeners for secure User-Profile-Tenant resolution.
- **AI-Driven Operations**: Intelligent expense categorization and financial auditing via Genkit.
- **Modern Tech Stack**: Next.js 15 (App Router), Firebase (Firestore/Auth), ShadCN UI, and Tailwind.
- **Professional Accessibility**: Fully standardized form fields with unique IDs and autocomplete hints.

## Key Modules
- **Store Terminal**: Fast POS checkout with support for Cash, Card, and Store Charge (AR).
- **Live Inventory**: Real-time stock monitoring with critical alert thresholds.
- **AI Expense Registry**: Automated categorization of business outflows.
- **AR Ledger**: Dedicated management for B2B client debts and collections.
- **Admin Registry**: Centralized node management for platform super-admins.

## License
MIT License - Copyright (c) 2024 FreshTally. See LICENSE for details.
