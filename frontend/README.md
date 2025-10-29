# BidKore Frontend

A modern Next.js 14 application built with the latest technologies and best practices.

## 🚀 Tech Stack

- **Next.js 14** - The React framework for production
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Beautifully designed components
- **Lucide React** - Beautiful & consistent icons

## 📦 Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd bidkore-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🛠️ Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint for code quality

## 📁 Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page
├── components/          # React components
│   └── ui/              # shadcn/ui components
└── lib/                 # Utility functions
    └── utils.ts         # Common utilities
```

## 🎨 Adding Components

To add new shadcn/ui components:

```bash
npx shadcn@latest add <component-name>
```

## 🌙 Dark Mode

The application supports dark mode out of the box with Tailwind CSS and shadcn/ui.

## 📱 Responsive Design

Built with mobile-first responsive design using Tailwind CSS utilities.

## 🔧 Customization

- Modify `tailwind.config.ts` for custom Tailwind configuration
- Update `components.json` for shadcn/ui component configuration
- Add custom components in the `src/components` directory

## 📄 License

This project is licensed under the MIT License.