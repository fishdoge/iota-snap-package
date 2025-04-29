# Sui Mate Wallet Frontend

This is a frontend application for connecting to the Sui Mate Wallet via WebSocket. It provides a user interface for connecting to wallets, generating QR codes for mobile connections, and executing transactions.

## Features

- Connect to standard Sui wallets
- Connect to Sui Mate Wallet via WebSocket
- Generate QR codes for mobile connections
- Execute transactions on the Sui blockchain

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Backend server running on port 3001

## Installation

1. Install dependencies:

```bash
npm install
```

or

```bash
yarn install
```

## Running the Application

Start the development server:

```bash
npm start
```

or

```bash
yarn start
```

The application will run on port 3333 and can be accessed at [http://localhost:3333](http://localhost:3333).

## Usage

### Connecting to a Wallet

1. Open the application in your browser
2. Click on "Connect to Sui Mate Wallet" to generate a QR code
3. Scan the QR code with your mobile device or open it in another browser
4. Connect your wallet on the connect page
5. The main page will update to show your connected wallet

### Executing Transactions

1. Connect your wallet
2. Click on "Execute Simple Transaction" to send a test transaction
3. The transaction result will be displayed on the page

## Project Structure

- `src/App.tsx`: Main application component
- `src/contexts/WalletContext.tsx`: Context for wallet integration
- `src/pages/Connect.tsx`: Page for connecting to wallets via QR code
- `public/`: Static assets

## Development

To modify the application, edit the files in the `src` directory. The application will automatically reload when you make changes.

## Building for Production

To build the application for production:

```bash
npm run build
```

or

```bash
yarn build
```

The build artifacts will be stored in the `build` directory.
