# Sui Mate Wallet Backend

This is the backend server for the Sui Mate Wallet. It provides a WebSocket server that handles wallet operations like signing messages and transactions.

## Features

- WebSocket server for real-time communication
- Connection key generation for secure pairing
- QR code-based authentication flow
- Message signing and transaction execution
- Support for multiple wallet accounts

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Install dependencies:

```bash
npm install
```

or

```bash
yarn install
```

2. Build the project:

```bash
npm run build
```

or

```bash
yarn build
```

## Running the Server

Start the server in development mode:

```bash
npm run dev
```

or

```bash
yarn dev
```

Start the server in production mode:

```bash
npm start
```

or

```bash
yarn start
```

By default, the server runs on port 3001. You can change this by setting the `PORT` environment variable.

## API

The WebSocket server supports the following methods:

### `requestConnectionKey`

Request a new connection key for pairing.

**Request:**
```json
{
  "id": "request-id",
  "method": "requestConnectionKey",
  "params": {}
}
```

**Response:**
```json
{
  "id": "request-id",
  "result": "connection-key"
}
```

### `waitForAuthentication`

Wait for authentication of a connection key.

**Request:**
```json
{
  "id": "request-id",
  "method": "waitForAuthentication",
  "params": {
    "key": "connection-key"
  }
}
```

**Response:**
```json
{
  "id": "request-id",
  "result": [
    {
      "address": "wallet-address",
      "publicKey": "public-key",
      "features": [
        "sui:signPersonalMessage",
        "sui:signMessage",
        "sui:signTransactionBlock",
        "sui:signAndExecuteTransactionBlock"
      ],
      "chains": ["sui:mainnet"]
    }
  ]
}
```

### `authenticateConnection`

Authenticate a connection key with a wallet.

**Request:**
```json
{
  "id": "request-id",
  "method": "authenticateConnection",
  "params": {
    "key": "connection-key",
    "address": "wallet-address",
    "publicKey": "public-key",
    "privateKey": "private-key"
  }
}
```

**Response:**
```json
{
  "id": "request-id",
  "result": {
    "success": true
  }
}
```

### `signPersonalMessage`

Sign a personal message.

**Request:**
```json
{
  "id": "request-id",
  "method": "signPersonalMessage",
  "params": {
    "key": "connection-key",
    "input": {
      "message": "base64-encoded-message"
    }
  }
}
```

**Response:**
```json
{
  "id": "request-id",
  "result": {
    "signature": "base64-encoded-signature",
    "bytes": "base64-encoded-message"
  }
}
```

### `signTransactionBlock`

Sign a transaction block.

**Request:**
```json
{
  "id": "request-id",
  "method": "signTransactionBlock",
  "params": {
    "key": "connection-key",
    "input": {
      "transactionBlock": "serialized-transaction-block"
    }
  }
}
```

**Response:**
```json
{
  "id": "request-id",
  "result": {
    "signature": "base64-encoded-signature",
    "transactionBlockBytes": "base64-encoded-transaction-block"
  }
}
```

### `signAndExecuteTransactionBlock`

Sign and execute a transaction block.

**Request:**
```json
{
  "id": "request-id",
  "method": "signAndExecuteTransactionBlock",
  "params": {
    "key": "connection-key",
    "input": {
      "transactionBlock": "serialized-transaction-block"
    }
  }
}
```

**Response:**
```json
{
  "id": "request-id",
  "result": {
    // Transaction execution result from Sui
  }
}
```

## Error Handling

All methods return an error response if something goes wrong:

```json
{
  "id": "request-id",
  "error": {
    "message": "Error message"
  }
}
```

## Security Considerations

- The connection key is used to authenticate the connection between the frontend and backend.
- The private key is stored in memory only and is not persisted to disk.
- All communication is done over WebSocket, which should be secured with TLS in production.
