import {
  ReadonlyWalletAccount,
  StandardConnectFeature,
  StandardConnectMethod,
  StandardDisconnectFeature,
  StandardDisconnectMethod,
  StandardEventsFeature,
  IotaFeatures,
  IotaSignAndExecuteTransactionMethod,
  IotaSignAndExecuteTransactionOutput,
  IotaSignPersonalMessageInput,
  IotaSignPersonalMessageMethod,
  IotaSignPersonalMessageOutput,
  IotaSignTransactionInput,
  IotaSignTransactionMethod,
  IotaSignTransactionOutput,
  Wallet,
  WalletAccount,
  getWallets,
} from "@iota/wallet-standard";
import { ICON } from "./icon";
import {
  SerializedWalletAccount,
  serializeIotaSignAndExecuteTransactionBlockInput,
  serializeIotaSignMessageInput,
  serializeIotaSignTransactionBlockInput,
} from "./types";
import { convertError, IotaSnapError } from "./errors";
import QRCode from "qrcode";

export * from "./types";
export * from "./errors";

// WebSocket server URL
export const WEBSOCKET_SERVER_URL = "ws://localhost:3001";

export function registerIotaMateWallet(): Wallet {
  const wallets = getWallets();
  for (const wallet of wallets.get()) {
    if (wallet.name === IotaMateWallet.NAME) {
      console.warn("IotaMateWallet already registered");
      return wallet;
    }
  }

  const wallet = new IotaMateWallet();
  wallets.register(wallet as unknown as Wallet);
  return wallet;
}

// WebSocket connection class
class WebSocketConnection {
  private ws: WebSocket | null = null;
  private connectionKey: string | null = null;
  private resolvers: Map<string, { resolve: Function; reject: Function }> =
    new Map();
  private accounts: ReadonlyWalletAccount[] | null = null;
  private isConnecting: boolean = false;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number = 1000;

  constructor() {
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  async connect(): Promise<ReadonlyWalletAccount[]> {
    if (this.isConnecting) {
      throw new IotaSnapError("Already connecting to WebSocket");
    }

    if (this.isConnected && this.accounts) {
      return this.accounts;
    }

    this.isConnecting = true;

    try {
      await this.establishConnection();
      const key = await this.requestConnectionKey();
      await this.showQRCodePopup(key);
      this.accounts = await this.waitForAuthentication(key);

      this.isConnecting = false;
      this.isConnected = true;

      return this.accounts;
    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;
      throw error;
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionKey = null;
    this.accounts = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.resolvers.clear();
  }

  private async establishConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WEBSOCKET_SERVER_URL);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = this.handleMessage;
        this.ws.onclose = this.handleClose;
        this.ws.onerror = (event) => {
          this.handleError(event);
          reject(new IotaSnapError("WebSocket connection error"));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private async requestConnectionKey(): Promise<string> {
    if (!this.ws) {
      throw new IotaSnapError("WebSocket not connected");
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      this.resolvers.set(requestId, { resolve, reject });

      this.ws!.send(
        JSON.stringify({
          id: requestId,
          method: "requestConnectionKey",
          params: {},
        })
      );

      // Set timeout for key request
      setTimeout(() => {
        if (this.resolvers.has(requestId)) {
          this.resolvers.delete(requestId);
          reject(new IotaSnapError("Connection key request timeout"));
        }
      }, 30000); // 30 seconds timeout
    });
  }

  private async showQRCodePopup(key: string): Promise<void> {
    try {
      // Store the connection key
      this.connectionKey = key;

      // Generate QR code
      const qrCodeDataUrl = await QRCode.toDataURL(key);

      // Create popup window
      const popupWindow = window.open(
        "",
        "IotaMateWalletQRCode",
        "width=350,height=450"
      );
      if (!popupWindow) {
        throw new IotaSnapError(
          "Could not open QR code popup. Please allow popups for this site."
        );
      }

      // Set popup content
      popupWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Iota Mate Wallet</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: white;
              border-radius: 10px;
              padding: 20px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            h2 {
              color: #333;
              margin-bottom: 20px;
            }
            p {
              color: #666;
              margin-bottom: 20px;
            }
            img {
              max-width: 200px;
              height: auto;
              margin: 0 auto;
              display: block;
              border: 1px solid #eee;
            }
            .key {
              font-family: monospace;
              background-color: #f0f0f0;
              padding: 8px;
              border-radius: 4px;
              word-break: break-all;
              margin-top: 15px;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Iota Mate Wallet</h2>
            <p>Scan this QR code with your mobile wallet app</p>
            <img src="${qrCodeDataUrl}" alt="QR Code" />
            <div class="key">
              <strong>Connection Key:</strong><br>
              ${key}
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      console.error("Error showing QR code:", error);
      throw new IotaSnapError("Failed to display QR code");
    }
  }

  private async waitForAuthentication(
    key: string
  ): Promise<ReadonlyWalletAccount[]> {
    if (!this.ws) {
      throw new IotaSnapError("WebSocket not connected");
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      this.resolvers.set(requestId, { resolve, reject });

      this.ws!.send(
        JSON.stringify({
          id: requestId,
          method: "waitForAuthentication",
          params: { key },
        })
      );

      // Set timeout for authentication
      setTimeout(() => {
        if (this.resolvers.has(requestId)) {
          this.resolvers.delete(requestId);
          reject(new IotaSnapError("Authentication timeout"));
        }
      }, 300000); // 5 minutes timeout
    });
  }

  async signPersonalMessage(
    messageInput: IotaSignPersonalMessageInput
  ): Promise<IotaSignPersonalMessageOutput> {
    if (!this.ws || !this.isConnected || !this.connectionKey) {
      throw new IotaSnapError("WebSocket not connected");
    }

    const serialized = serializeIotaSignMessageInput(messageInput);

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      this.resolvers.set(requestId, { resolve, reject });

      this.ws!.send(
        JSON.stringify({
          id: requestId,
          method: "signPersonalMessage",
          params: {
            key: this.connectionKey,
            input: serialized,
          },
        })
      );

      // Set timeout for signing
      setTimeout(() => {
        if (this.resolvers.has(requestId)) {
          this.resolvers.delete(requestId);
          reject(new IotaSnapError("Sign personal message timeout"));
        }
      }, 60000); // 1 minute timeout
    });
  }

  async signMessage(
    messageInput: IotaSignPersonalMessageInput
  ): Promise<IotaSignPersonalMessageOutput> {
    const result = await this.signPersonalMessage(messageInput);
    return result;
  }

  async signTransactionBlock(
    transactionInput: IotaSignTransactionInput
  ): Promise<IotaSignTransactionOutput> {
    if (!this.ws || !this.isConnected || !this.connectionKey) {
      throw new IotaSnapError("WebSocket not connected");
    }

    const serialized = await serializeIotaSignTransactionBlockInput(
      transactionInput
    );

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      this.resolvers.set(requestId, { resolve, reject });

      this.ws!.send(
        JSON.stringify({
          id: requestId,
          method: "signTransactionBlock",
          params: {
            key: this.connectionKey,
            input: serialized,
          },
        })
      );

      // Set timeout for signing
      setTimeout(() => {
        if (this.resolvers.has(requestId)) {
          this.resolvers.delete(requestId);
          reject(new IotaSnapError("Sign transaction block timeout"));
        }
      }, 60000); // 1 minute timeout
    });
  }

  async signAndExecuteTransactionBlock(
    transactionInput: IotaSignTransactionInput
  ): Promise<IotaSignAndExecuteTransactionOutput> {
    if (!this.ws || !this.isConnected || !this.connectionKey) {
      throw new IotaSnapError("WebSocket not connected");
    }

    const serialized = await serializeIotaSignAndExecuteTransactionBlockInput(
      transactionInput
    );

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      this.resolvers.set(requestId, { resolve, reject });

      this.ws!.send(
        JSON.stringify({
          id: requestId,
          method: "signAndExecuteTransactionBlock",
          params: {
            key: this.connectionKey,
            input: serialized,
          },
        })
      );

      // Set timeout for signing and execution
      setTimeout(() => {
        if (this.resolvers.has(requestId)) {
          this.resolvers.delete(requestId);
          reject(
            new IotaSnapError("Sign and execute transaction block timeout")
          );
        }
      }, 120000); // 2 minutes timeout
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      if (data.id && this.resolvers.has(data.id)) {
        const { resolve, reject } = this.resolvers.get(data.id)!;
        this.resolvers.delete(data.id);

        if (data.error) {
          reject(new IotaSnapError(data.error.message || "Unknown error"));
        } else {
          resolve(data.result);
        }
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  }

  private handleClose(event: CloseEvent): void {
    this.isConnected = false;

    // Attempt to reconnect if not intentionally disconnected
    if (this.accounts && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;

      setTimeout(() => {
        this.establishConnection().catch(console.error);
      }, this.reconnectTimeout * this.reconnectAttempts);
    }
  }

  private handleError(event: Event): void {
    console.error("WebSocket error:", event);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Check if WebSocket is available in the environment
export function isWebSocketAvailable(): boolean {
  return typeof WebSocket !== "undefined";
}

export class IotaMateWallet implements Wallet {
  static NAME = "Iota Mate Wallet";
  #connecting: boolean;
  #connected: boolean;
  #accounts: WalletAccount[] | null = null;
  #wsConnection: WebSocketConnection;

  constructor() {
    this.#connecting = false;
    this.#connected = false;
    this.#wsConnection = new WebSocketConnection();
  }

  get version() {
    return "1.0.0" as const;
  }

  get name() {
    return IotaMateWallet.NAME;
  }

  get icon() {
    return ICON as `data:image/svg+xml;base64,${string}`;
  }

  get chains() {
    return [
      "iota:mainnet",
      "iota:testnet",
      "iota:devnet",
      "iota:localnet",
    ] as `${string}:${string}`[];
  }

  get connecting() {
    return this.#connecting;
  }

  get accounts() {
    if (this.#connected && this.#accounts) {
      return this.#accounts;
    } else {
      return [];
    }
  }

  get features(): StandardConnectFeature &
    StandardDisconnectFeature &
    IotaFeatures &
    StandardEventsFeature {
    return {
      "standard:connect": {
        version: "1.0.0" as any,
        connect: this.#connect,
      },
      "standard:disconnect": {
        version: "1.0.0" as any,
        disconnect: this.#disconnect,
      },
      "iota:signPersonalMessage": {
        version: "1.0.0" as any,
        signPersonalMessage: this.#signPersonalMessage,
      },
      "iota:signMessage": {
        version: "1.0.0" as any,
        signMessage: this.#signMessage,
      },
      "iota:signTransactionBlock": {
        version: "1.0.0" as any,
        signTransactionBlock: this.#signTransactionBlock,
      },
      "iota:signAndExecuteTransactionBlock": {
        version: "1.0.0" as any,
        signAndExecuteTransactionBlock: this.#signAndExecuteTransactionBlock,
      },
      "standard:events": {
        version: "1.0.0" as any,
        on: () => {
          return () => {};
        },
      },
    } as any;
  }

  #connect: StandardConnectMethod = async () => {
    if (this.#connecting) {
      throw new Error("Already connecting");
    }

    if (!isWebSocketAvailable()) {
      throw new Error("WebSocket is not available in this environment");
    }

    this.#connecting = true;
    this.#connected = false;

    try {
      const accounts = await this.#wsConnection.connect();
      this.#accounts = accounts as WalletAccount[];

      this.#connecting = false;
      this.#connected = true;

      return {
        accounts: this.accounts,
      };
    } catch (e) {
      this.#connecting = false;
      this.#connected = false;
      throw convertError(e);
    }
  };

  #disconnect: StandardDisconnectMethod = async () => {
    this.#wsConnection.disconnect();
    this.#connecting = false;
    this.#connected = false;
    this.#accounts = null;
  };

  #signPersonalMessage: IotaSignPersonalMessageMethod = async (
    messageInput
  ) => {
    if (!this.#connected) {
      throw new Error("Wallet not connected");
    }

    try {
      return await this.#wsConnection.signPersonalMessage(messageInput);
    } catch (e) {
      throw convertError(e);
    }
  };

  #signMessage: IotaSignPersonalMessageMethod = async (messageInput) => {
    if (!this.#connected) {
      throw new Error("Wallet not connected");
    }
    try {
      return await this.#wsConnection.signMessage(messageInput);
    } catch (e) {
      throw convertError(e);
    }
  };

  #signTransactionBlock: IotaSignTransactionMethod = async (
    transactionInput
  ) => {
    if (!this.#connected) {
      throw new Error("Wallet not connected");
    }

    try {
      return await this.#wsConnection.signTransactionBlock(transactionInput);
    } catch (e) {
      throw convertError(e);
    }
  };

  #signAndExecuteTransactionBlock: IotaSignAndExecuteTransactionMethod = async (
    transactionInput
  ) => {
    if (!this.#connected) {
      throw new Error("Wallet not connected");
    }

    try {
      return await this.#wsConnection.signAndExecuteTransactionBlock(
        transactionInput
      );
    } catch (e) {
      throw convertError(e);
    }
  };
}
