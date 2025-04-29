import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import { fromB64, toB64 } from "@mysten/sui.js/utils";
import { TransactionBlock } from "@mysten/sui.js/transactions";

// WebSocket server URL
const WS_URL = "ws://localhost:3001";

// Create WebSocket connection
const ws = new WebSocket(WS_URL);

// Connection key
let connectionKey: string | null = null;

// Handle WebSocket open event
ws.on("open", () => {
  console.log("Connected to WebSocket server");

  // Request connection key
  requestConnectionKey();
});

// Handle WebSocket message event
ws.on("message", (data: WebSocket.Data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log("Received message:", message);

    // Handle response based on request ID
    handleResponse(message);
  } catch (error) {
    console.error("Error parsing message:", error);
  }
});

// Handle WebSocket close event
ws.on("close", () => {
  console.log("Disconnected from WebSocket server");
});

// Handle WebSocket error event
ws.on("error", (error) => {
  console.error("WebSocket error:", error);
});

/**
 * Send a message to the WebSocket server
 * @param method Method name
 * @param params Method parameters
 * @returns Request ID
 */
function sendMessage(method: string, params: any = {}): string {
  const id = uuidv4();
  const message = {
    id,
    method,
    params,
  };

  console.log("Sending message:", message);
  ws.send(JSON.stringify(message));

  return id;
}

/**
 * Request a connection key
 */
function requestConnectionKey(): void {
  sendMessage("requestConnectionKey");
}

/**
 * Authenticate connection with a wallet
 * @param key Connection key
 * @param address Wallet address
 * @param publicKey Wallet public key
 * @param privateKey Wallet private key
 */
function authenticateConnection(
  key: string,
  address: string,
  publicKey: string,
  privateKey: string
): void {
  sendMessage("authenticateConnection", {
    key,
    address,
    publicKey,
    privateKey,
  });
}

/**
 * Wait for authentication
 * @param key Connection key
 */
function waitForAuthentication(key: string): void {
  sendMessage("waitForAuthentication", {
    key,
  });
}

/**
 * Sign a personal message
 * @param key Connection key
 * @param message Message to sign
 */
function signPersonalMessage(key: string, message: string): void {
  const encodedMessage = toB64(new TextEncoder().encode(message));

  sendMessage("signPersonalMessage", {
    key,
    input: {
      message: encodedMessage,
    },
  });
}

/**
 * Sign a transaction block
 * @param key Connection key
 * @param transactionBlock Transaction block
 */
function signTransactionBlock(
  key: string,
  transactionBlock: TransactionBlock
): void {
  sendMessage("signTransactionBlock", {
    key,
    input: {
      transactionBlock: transactionBlock.serialize(),
    },
  });
}

/**
 * Sign and execute a transaction block
 * @param key Connection key
 * @param transactionBlock Transaction block
 */
function signAndExecuteTransactionBlock(
  key: string,
  transactionBlock: TransactionBlock
): void {
  sendMessage("signAndExecuteTransactionBlock", {
    key,
    input: {
      transactionBlock: transactionBlock.serialize(),
    },
  });
}

/**
 * Handle response from the WebSocket server
 * @param message Response message
 */
function handleResponse(message: any): void {
  const { id, result, error } = message;

  if (error) {
    console.error("Error:", error);
    return;
  }

  // Handle response based on request ID
  if (id.startsWith("requestConnectionKey")) {
    // Store connection key
    connectionKey = result;
    console.log("Connection key:", connectionKey);

    // For testing, we can simulate a mobile wallet authenticating the connection
    // In a real scenario, the mobile wallet would scan the QR code and authenticate
    simulateMobileWalletAuthentication(connectionKey);
  } else if (id.startsWith("authenticateConnection")) {
    console.log("Authentication result:", result);

    // Wait for authentication
    if (connectionKey) {
      waitForAuthentication(connectionKey);
    }
  } else if (id.startsWith("waitForAuthentication")) {
    console.log("Authentication complete. Accounts:", result);

    // Now we can sign messages and transactions
    if (connectionKey && result && result.length > 0) {
      // Sign a personal message
      signPersonalMessage(connectionKey, "Hello, Sui Mate Wallet!");
    }
  } else if (id.startsWith("signPersonalMessage")) {
    console.log("Message signature:", result);

    // Create a simple transaction block
    if (connectionKey) {
      const txb = new TransactionBlock();
      // Add transaction operations here

      // Sign the transaction block
      signTransactionBlock(connectionKey, txb);
    }
  } else if (id.startsWith("signTransactionBlock")) {
    console.log("Transaction signature:", result);

    // We could also sign and execute a transaction block
    // signAndExecuteTransactionBlock(connectionKey, txb);
  } else if (id.startsWith("signAndExecuteTransactionBlock")) {
    console.log("Transaction execution result:", result);
  }
}

/**
 * Simulate a mobile wallet authenticating the connection
 * @param key Connection key
 */
function simulateMobileWalletAuthentication(key: string): void {
  // In a real scenario, the mobile wallet would scan the QR code and authenticate
  // Here we simulate it by creating a wallet and authenticating the connection

  // Create a wallet (in a real scenario, this would be the mobile wallet)
  const address = "0x1234567890abcdef1234567890abcdef12345678";
  const publicKey = "publicKeyBase64String";
  const privateKey = "privateKeyBase64String";

  // Authenticate the connection
  authenticateConnection(key, address, publicKey, privateKey);
}

// Handle process exit
process.on("SIGINT", () => {
  console.log("Closing WebSocket connection");
  ws.close();
  process.exit(0);
});
