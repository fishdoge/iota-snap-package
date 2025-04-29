import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";

// Interface for connection data
export interface Connection {
  ws: WebSocket;
  key: string;
  authenticated: boolean;
  address?: string;
  publicKey?: string;
  pendingAuthentication?: {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  };
}

export class ConnectionManager {
  private connections: Map<string, Connection> = new Map();
  private wsToKey: Map<WebSocket, string> = new Map();

  /**
   * Create a new connection with a unique key
   * @param ws WebSocket connection
   * @returns The connection key
   */
  public createConnection(ws: WebSocket): string {
    // Generate a unique key
    const key = uuidv4();

    // Store the connection
    this.connections.set(key, {
      ws,
      key,
      authenticated: false,
    });

    // Map WebSocket to key for easy lookup
    this.wsToKey.set(ws, key);

    return key;
  }

  /**
   * Get a connection by its key
   * @param key Connection key
   * @returns The connection or undefined if not found
   */
  public getConnection(key: string): Connection | undefined {
    return this.connections.get(key);
  }

  /**
   * Get a connection by its WebSocket
   * @param ws WebSocket connection
   * @returns The connection or undefined if not found
   */
  public getConnectionByWebSocket(ws: WebSocket): Connection | undefined {
    const key = this.wsToKey.get(ws);
    if (key) {
      return this.connections.get(key);
    }
    return undefined;
  }

  /**
   * Remove a connection by its key
   * @param key Connection key
   */
  public removeConnection(key: string): void {
    const connection = this.connections.get(key);
    if (connection) {
      this.wsToKey.delete(connection.ws);
      this.connections.delete(key);
    }
  }

  /**
   * Remove a connection by its WebSocket
   * @param ws WebSocket connection
   */
  public removeConnectionByWebSocket(ws: WebSocket): void {
    const key = this.wsToKey.get(ws);
    if (key) {
      this.connections.delete(key);
      this.wsToKey.delete(ws);
    }
  }

  /**
   * Authenticate a connection
   * @param key Connection key
   * @param address Wallet address
   * @param publicKey Wallet public key
   * @returns True if authentication was successful, false otherwise
   */
  public authenticateConnection(
    key: string,
    address: string,
    publicKey: string
  ): boolean {
    const connection = this.connections.get(key);
    if (connection) {
      connection.authenticated = true;
      connection.address = address;
      connection.publicKey = publicKey;

      // Resolve pending authentication if any
      if (connection.pendingAuthentication) {
        connection.pendingAuthentication.resolve({
          address,
          publicKey,
        });
        delete connection.pendingAuthentication;
      }

      return true;
    }
    return false;
  }

  /**
   * Wait for authentication of a connection
   * @param key Connection key
   * @returns Promise that resolves when the connection is authenticated
   */
  public waitForAuthentication(key: string): Promise<any> {
    const connection = this.connections.get(key);
    if (!connection) {
      return Promise.reject(new Error("Connection not found"));
    }

    if (connection.authenticated) {
      return Promise.resolve({
        address: connection.address,
        publicKey: connection.publicKey,
      });
    }

    return new Promise((resolve, reject) => {
      connection.pendingAuthentication = { resolve, reject };
    });
  }

  /**
   * Check if a connection is authenticated
   * @param key Connection key
   * @returns True if the connection is authenticated, false otherwise
   */
  public isAuthenticated(key: string): boolean {
    const connection = this.connections.get(key);
    return connection ? connection.authenticated : false;
  }
}
