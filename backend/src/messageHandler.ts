import { WebSocket } from "ws";
import { ConnectionManager } from "./connectionManager";
import { WalletManager } from "./walletManager";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { fromB64 } from "@mysten/sui.js/utils";

// Interface for incoming message
interface Message {
  id: string;
  method: string;
  params: any;
}

export class MessageHandler {
  private connectionManager: ConnectionManager;
  private walletManager: WalletManager;

  constructor(
    connectionManager: ConnectionManager,
    walletManager: WalletManager
  ) {
    this.connectionManager = connectionManager;
    this.walletManager = walletManager;
  }

  /**
   * Handle incoming WebSocket message
   * @param ws WebSocket connection
   * @param message Incoming message
   * @returns Response to send back to the client
   */
  public async handleMessage(ws: WebSocket, message: Message): Promise<any> {
    const { id, method, params } = message;

    try {
      switch (method) {
        case "requestConnectionKey":
          return this.handleRequestConnectionKey(id, ws);
        case "waitForAuthentication":
          return this.handleWaitForAuthentication(id, params);
        case "signPersonalMessage":
          return this.handleSignPersonalMessage(id, params);
        case "signTransactionBlock":
          return this.handleSignTransactionBlock(id, params);
        case "signAndExecuteTransactionBlock":
          return this.handleSignAndExecuteTransactionBlock(id, params);
        case "authenticateConnection":
          return this.handleAuthenticateConnection(id, params);
        default:
          return {
            id,
            error: {
              message: `Method not supported: ${method}`,
            },
          };
      }
    } catch (error) {
      console.error(`Error handling message ${method}:`, error);
      return {
        id,
        error: {
          message: (error as Error).message,
        },
      };
    }
  }

  /**
   * Handle request for a connection key
   * @param id Message ID
   * @param ws WebSocket connection
   * @returns Response with connection key
   */
  private handleRequestConnectionKey(id: string, ws: WebSocket): any {
    const key = this.connectionManager.createConnection(ws);
    return {
      id,
      result: key,
    };
  }

  /**
   * Handle wait for authentication
   * @param id Message ID
   * @param params Message parameters
   * @returns Response with authentication result
   */
  private async handleWaitForAuthentication(
    id: string,
    params: any
  ): Promise<any> {
    const { key } = params;
    if (!key) {
      return {
        id,
        error: {
          message: "Missing key parameter",
        },
      };
    }

    try {
      // Wait for authentication
      const result = await this.connectionManager.waitForAuthentication(key);

      // Create wallet accounts array
      const accounts = [
        {
          address: result.address,
          publicKey: result.publicKey,
          features: [
            "sui:signPersonalMessage",
            "sui:signMessage",
            "sui:signTransactionBlock",
            "sui:signAndExecuteTransactionBlock",
          ],
          chains: ["sui:mainnet"],
        },
      ];

      return {
        id,
        result: accounts,
      };
    } catch (error) {
      return {
        id,
        error: {
          message: (error as Error).message,
        },
      };
    }
  }

  /**
   * Handle sign personal message
   * @param id Message ID
   * @param params Message parameters
   * @returns Response with signature
   */
  private handleSignPersonalMessage(id: string, params: any): any {
    const { key, input } = params;
    if (!key || !input) {
      return {
        id,
        error: {
          message: "Missing key or input parameter",
        },
      };
    }

    // Check if connection is authenticated
    if (!this.connectionManager.isAuthenticated(key)) {
      return {
        id,
        error: {
          message: "Connection not authenticated",
        },
      };
    }

    // Get connection
    const connection = this.connectionManager.getConnection(key);
    if (!connection || !connection.address) {
      return {
        id,
        error: {
          message: "Connection not found or missing address",
        },
      };
    }

    try {
      // Sign message
      const message = fromB64(input.message);
      const result = this.walletManager.signPersonalMessage(
        connection.address,
        message
      );

      return {
        id,
        result,
      };
    } catch (error) {
      return {
        id,
        error: {
          message: (error as Error).message,
        },
      };
    }
  }

  /**
   * Handle sign transaction block
   * @param id Message ID
   * @param params Message parameters
   * @returns Response with signature
   */
  private handleSignTransactionBlock(id: string, params: any): any {
    const { key, input } = params;
    if (!key || !input) {
      return {
        id,
        error: {
          message: "Missing key or input parameter",
        },
      };
    }

    // Check if connection is authenticated
    if (!this.connectionManager.isAuthenticated(key)) {
      return {
        id,
        error: {
          message: "Connection not authenticated",
        },
      };
    }

    // Get connection
    const connection = this.connectionManager.getConnection(key);
    if (!connection || !connection.address) {
      return {
        id,
        error: {
          message: "Connection not found or missing address",
        },
      };
    }

    try {
      // Parse transaction block
      const transactionBlock = TransactionBlock.from(input.transactionBlock);

      // Sign transaction block
      const result = this.walletManager.signTransactionBlock(
        connection.address,
        transactionBlock
      );

      return {
        id,
        result,
      };
    } catch (error) {
      return {
        id,
        error: {
          message: (error as Error).message,
        },
      };
    }
  }

  /**
   * Handle sign and execute transaction block
   * @param id Message ID
   * @param params Message parameters
   * @returns Response with transaction result
   */
  private async handleSignAndExecuteTransactionBlock(
    id: string,
    params: any
  ): Promise<any> {
    const { key, input } = params;
    if (!key || !input) {
      return {
        id,
        error: {
          message: "Missing key or input parameter",
        },
      };
    }

    // Check if connection is authenticated
    if (!this.connectionManager.isAuthenticated(key)) {
      return {
        id,
        error: {
          message: "Connection not authenticated",
        },
      };
    }

    // Get connection
    const connection = this.connectionManager.getConnection(key);
    if (!connection || !connection.address) {
      return {
        id,
        error: {
          message: "Connection not found or missing address",
        },
      };
    }

    try {
      // Parse transaction block
      const transactionBlock = TransactionBlock.from(input.transactionBlock);

      // Sign and execute transaction block
      const result = await this.walletManager.signAndExecuteTransactionBlock(
        connection.address,
        transactionBlock
      );

      return {
        id,
        result,
      };
    } catch (error) {
      return {
        id,
        error: {
          message: (error as Error).message,
        },
      };
    }
  }

  /**
   * Handle authenticate connection
   * @param id Message ID
   * @param params Message parameters
   * @returns Response with authentication result
   */
  private handleAuthenticateConnection(id: string, params: any): any {
    const { key, address, publicKey, privateKey } = params;
    if (!key || !address || !publicKey || !privateKey) {
      return {
        id,
        error: {
          message: "Missing required parameters",
        },
      };
    }

    try {
      // Register wallet
      this.walletManager.registerWallet(address, publicKey, privateKey);

      // Authenticate connection
      const success = this.connectionManager.authenticateConnection(
        key,
        address,
        publicKey
      );

      return {
        id,
        result: { success },
      };
    } catch (error) {
      return {
        id,
        error: {
          message: (error as Error).message,
        },
      };
    }
  }
}
