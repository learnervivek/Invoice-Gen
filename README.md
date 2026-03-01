# 🧾 InvoiceGen — Conversational Invoice Generator

A production-ready MERN stack application that lets you **create invoices through a chat interface**, preview them in real-time, generate PDFs, and send them via Gmail.

![MERN](https://img.shields.io/badge/MERN-Stack-green) ![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

- **💬 Conversational Chat UI** — Build invoices step-by-step through natural conversation
- **👁️ Real-Time Preview** — See your invoice update live as you chat
- **📄 PDF Generation** — Generate professional PDFs via Invoice-Generator.com API
- **📧 Gmail Integration** — Send invoices directly via Gmail with PDF attachment
- **🔐 Google OAuth** — Secure authentication with Google sign-in
- **📝 Draft Saving** — Save and manage invoice drafts per user
- **🌙 Dark Mode** — Toggle between light and dark themes
- **📱 Responsive** — Works on desktop and tablet

## 🛠️ Tech Stack

| Layer     | Technology                          |
| --------- | ----------------------------------- |
| Frontend  | React (Vite), Tailwind CSS, Shadcn UI |
| Backend   | Node.js, Express.js                 |
| Database  | MongoDB with Mongoose               |
| Auth      | Google OAuth 2.0, JWT               |
| PDF       | Invoice-Generator.com API           |
| Email     | Gmail API via googleapis            |

## 📁 Project Structure

```
Inovice-generator/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/      # UI components
│   │   │   ├── ui/          # Shadcn primitives
│   │   │   ├── chat/        # Chat interface
│   │   │   ├── invoice/     # Invoice preview & list
│   │   │   └── layout/      # App layout
│   │   ├── pages/           # Route pages
│   │   ├── context/         # Auth context
│   │   └── lib/             # Utils & API client
│   └── ...
├── server/                  # Express backend
│   ├── config/              # DB & OAuth config
│   ├── controllers/         # Route handlers
│   ├── middleware/           # Auth & error handling
│   ├── models/              # Mongoose schemas
│   ├── routes/              # API routes
│   └── services/            # PDF & email services
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **MongoDB** (local or [Atlas](https://www.mongodb.com/atlas))
- **Google Cloud Console** project with:
  - OAuth 2.0 credentials
  - Gmail API enabled
- **Invoice-Generator.com** API key ([get one here](https://invoice-generator.com))

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd Inovice-generator
```

### 2. Set up the backend

```bash
cd server
cp .env.example .env
# Edit .env with your actual values
npm install
```

#### `.env` configuration

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/invoice-generator
JWT_SECRET=<your-random-secret>

GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

INVOICE_GENERATOR_API_KEY=<your-api-key>

CLIENT_URL=http://localhost:5173
```

### 3. Set up the frontend

```bash
cd ../client
npm install
```

### 4. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable the **Gmail API**
4. Go to **Credentials** → Create **OAuth 2.0 Client ID**
5. Set Authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
6. Copy Client ID and Client Secret to your `.env`

### 5. Run the app

In two terminals:

```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — Frontend
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

## 📡 API Endpoints

### Auth
| Method | Endpoint                    | Description              |
| ------ | --------------------------- | ------------------------ |
| GET    | `/api/auth/google`          | Start Google OAuth flow  |
| GET    | `/api/auth/google/callback` | OAuth callback           |
| GET    | `/api/auth/me`              | Get current user         |
| POST   | `/api/auth/logout`          | Logout                   |

### Invoices
| Method | Endpoint                           | Description         |
| ------ | ---------------------------------- | ------------------- |
| GET    | `/api/invoices`                    | List user invoices  |
| GET    | `/api/invoices/:id`                | Get single invoice  |
| POST   | `/api/invoices`                    | Create invoice      |
| PUT    | `/api/invoices/:id`                | Update invoice      |
| DELETE | `/api/invoices/:id`                | Delete invoice      |
| POST   | `/api/invoices/:id/generate-pdf`   | Generate PDF        |
| POST   | `/api/invoices/:id/send`           | Send via Gmail      |

### Chat
| Method | Endpoint             | Description             |
| ------ | -------------------- | ----------------------- |
| POST   | `/api/chat/message`  | Process chat message    |

## 📄 License

MIT
