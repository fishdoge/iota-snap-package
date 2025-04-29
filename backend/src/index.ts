import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import { ConnectionManager } from "./connectionManager";
import { MessageHandler } from "./messageHandler";
import { WalletManager } from "./walletManager";

// Create Express app
const app = express();
const port = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Create connection manager
const connectionManager = new ConnectionManager();

// Create wallet manager
const walletManager = new WalletManager();

// Create message handler
const messageHandler = new MessageHandler(connectionManager, walletManager);

// WebSocket connection handler
wss.on("connection", (ws) => {
  console.log("Client connected");

  // Handle messages from clients
  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log("Received message:", data);

      // Process the message and send response
      const response = await messageHandler.handleMessage(ws, data);

      if (response) {
        ws.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error("Error processing message:", error);
      ws.send(
        JSON.stringify({
          id: "error",
          error: {
            message: "Error processing message",
            details: (error as Error).message,
          },
        })
      );
    }
  });

  // Handle client disconnection
  ws.on("close", () => {
    console.log("Client disconnected");
    connectionManager.removeConnectionByWebSocket(ws);
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    connectionManager.removeConnectionByWebSocket(ws);
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Handle server shutdown
process.on("SIGINT", () => {
  console.log("Server shutting down");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
