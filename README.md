# redDKit

A sleek, cross-platform Reddit browser built with Electron. Browse subreddits, view posts, and explore comments with infinite scrolling.

![redDKit Screenshot](screenshot.png)

## Features

- Search and browse subreddits
- View posts with threaded comments
- Infinite scroll for post listings
- Configurable sort options (Hot, New, Top)
- Clean, responsive UI

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/reddkit.git
   cd reddkit
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

## Building for Production

### Windows
```bash
npm run build:win
```

### macOS
```bash
npm run build:mac
```

### Linux
```bash
npm run build:linux
```

Built packages will be available in the `dist` directory.

## Project Structure

- `main.js` - Electron entry point
- `server/` - Express server for handling API requests
- `client/public/` - Client-side HTML, CSS, and JS
- `client/public/app.js` - Main client-side application logic
- `client/public/styles.css` - Application styling

## How It Works

redDKit uses a combination of:

- **Electron** for cross-platform desktop capabilities
- **Express** for the backend API
- **HTMX** for enhanced HTML interactions
- **Reddit JSON API** for content

The application follows a client-server architecture even within Electron, making it easy to potentially separate these components in the future.

## Development Notes

- The server runs locally within the Electron process
- The app dynamically finds an available port to avoid conflicts
- Infinite scrolling is implemented using Reddit's pagination tokens

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Contact

Sveinbjorn - [sveinbjorn@sveinbjorn.dev](mailto:sveinbjorn@sveinbjorn.dev)

Website: [https://sveinbjorn.dev](https://sveinbjorn.dev)

---

*Note: This project is not affiliated with or endorsed by Reddit Inc.*
