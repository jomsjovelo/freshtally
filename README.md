# FreshTally - Cloud Store Ledger

FreshTally is a high-performance, AI-powered multi-tenant business management system. It provides store owners and staff with a secure, professional "Terminal" for real-time retail operations.

## 🚀 Migration to GitHub & App Hosting

If you see an error saying "Branch name must refer to a valid existing branch", it's because you haven't pushed your code yet. Run these commands in your project terminal:

1. **Initialize & Commit**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit from FreshTally Studio"
   ```

2. **Push to GitHub**:
   ```bash
   git branch -M main
   git remote add origin https://github.com/jomsjovelo/freshtally.git
   git push -u origin main
   ```

Once you run `git push`, the Firebase App Hosting setup will recognize the `main` branch and you can proceed!

## 🛠 Deployment Configuration

- **App root directory**: `/`
- **Live branch**: `main`
- **Environment**: Next.js 15 (App Router)

## Technical Features
- **Atomic Identity Handshake**: Chained Firestore listeners for secure User-Profile-Tenant resolution.
- **AI-Driven Operations**: Intelligent expense categorization and financial auditing via Genkit.
- **Modern Tech Stack**: Next.js 15, Firebase (Firestore/Auth), ShadCN UI, and Tailwind.

## License
MIT License - Copyright (c) 2024 FreshTally.
