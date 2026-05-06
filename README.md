# FreshTally - Cloud Store Ledger

FreshTally is a high-performance, AI-powered multi-tenant business management system. It provides store owners and staff with a secure, professional "Terminal" for real-time retail operations.

## 🚀 Migration to GitHub & App Hosting

If you see an error saying "Branch name must refer to a valid existing branch", it's because the repository on GitHub is currently empty. 

### If you have an existing repository locally:
Run these commands to link it to your new `freshtally` repo:

1. **Update Remote**:
   ```bash
   git remote remove origin
   git remote add origin https://github.com/jomsjovelo/freshtally.git
   ```

2. **Commit & Push**:
   ```bash
   git branch -M main
   git add .
   git commit -m "Migration to FreshTally GitHub"
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
