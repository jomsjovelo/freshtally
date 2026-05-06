
# FreshTally - Cloud Store Ledger

FreshTally is a high-performance, AI-powered multi-tenant business management system. It provides store owners and staff with a secure, professional "Terminal" for real-time retail operations.

## Core Vision
To empower small and medium enterprises with enterprise-grade ledger, inventory, and point-of-sale tools that are intuitive, fast, and secure.

## Technical Direction
- **Multi-Tenant Isolation**: Secure data partitioning via unique **Store Codes**.
- **AI-Driven Operations**: Intelligent expense categorization and financial auditing using **Genkit AI**.
- **Modern Tech Stack**: Next.js 15 (App Router), Firebase (Firestore/Auth), ShadCN UI, and Tailwind CSS.
- **Offline-First Resilience**: Leveraging Firestore's local cache for uninterrupted terminal operations.

## GitHub Migration
To move this project to GitHub or Antigravity, follow these steps:

1. **Initialize Git**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit from FreshTally Studio"
   ```

2. **Create a Remote Repository**: Create a new repository on GitHub.

3. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

## Key Features
- **Store Terminal**: Fast POS checkout with support for Cash, Card, and Store Charge (AR).
- **Live Inventory**: Real-time stock monitoring with critical alert thresholds.
- **AI Expense Registry**: Automated categorization of business outflows.
- **AR Ledger**: Dedicated management for B2B client debts and collections.
- **Admin Registry**: Centralized node management for platform super-admins.
