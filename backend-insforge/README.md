# Backend - Plataforma InsForge

## Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+) running on port 5432

## Setup

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Variables**
    Copy `.env.example` to `.env` (already done by agent, check values).
    Ensure `DB_PASSWORD` matches your local PostgreSQL setup.

3.  **Database Initialization**
    Ensure PostgreSQL is running.
    Run the initialization scripts:
    ```bash
    # Create database if it doesn't exist
    npx ts-node src/scripts/create-db.ts
    
    # Apply Schema and Seed data
    npx ts-node src/scripts/init-db.ts
    ```

4.  **Run Server**
    ```bash
    # Development
    npm run dev
    
    # Production
    npm start
    ```

## API Health Check
GET http://localhost:3000/health
