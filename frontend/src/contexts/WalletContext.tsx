import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getWallets, Wallet, WalletAccount } from "@mysten/wallet-standard";
import { SuiClient, SuiTransactionBlockResponse } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";

// Define the context type
interface WalletContextType {
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  accounts: WalletAccount[];
  connecting: boolean;
  connected: boolean;
  connectionKey: string | null;
  connectWallet: (wallet: Wallet) => Promise<void>;
  disconnectWallet: () => void;
  signAndExecuteTransactionBlock: (
    transactionBlock: TransactionBlock
  ) => Promise<SuiTransactionBlockResponse>;
  connectToMateWallet: () => Promise<void>;
}

// Create the context with a default value
const WalletContext = createContext<WalletContextType>({
  wallets: [],
  selectedWallet: null,
  accounts: [],
  connecting: false,
  connected: false,
  connectionKey: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  signAndExecuteTransactionBlock: async () => {
    throw new Error("Not implemented");
  },
  connectToMateWallet: async () => {},
});

// Provider component
export const WalletProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionKey, setConnectionKey] = useState<string | null>(null);
  const [suiClient] = useState(
    new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" })
  );

  // Initialize wallets
  useEffect(() => {
    const walletsApi = getWallets();
    const walletsList = walletsApi.get();
    setWallets(walletsList);

    // Listen for wallet changes
    const unsubscribe = walletsApi.on("change", () => {
      setWallets(walletsApi.get());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Connect to a wallet
  const connectWallet = async (wallet: Wallet) => {
    try {
      setConnecting(true);
      const features = wallet.features;

      if ("standard:connect" in features) {
        const connectFeature = features["standard:connect"];
        const response = await connectFeature.connect();
        setAccounts(response.accounts);
        setSelectedWallet(wallet);
        setConnected(true);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect from the wallet
  const disconnectWallet = () => {
    if (selectedWallet && "standard:disconnect" in selectedWallet.features) {
      const disconnectFeature = selectedWallet.features["standard:disconnect"];
      disconnectFeature.disconnect();
    }
    setSelectedWallet(null);
    setAccounts([]);
    setConnected(false);
    setConnectionKey(null);
  };

  // Sign and execute a transaction block
  const signAndExecuteTransactionBlock = async (
    transactionBlock: TransactionBlock
  ) => {
    if (!selectedWallet || !accounts.length) {
      throw new Error("Wallet not connected");
    }

    if (!("sui:signAndExecuteTransactionBlock" in selectedWallet.features)) {
      throw new Error("Wallet does not support signAndExecuteTransactionBlock");
    }

    const signAndExecuteFeature =
      selectedWallet.features["sui:signAndExecuteTransactionBlock"];

    const response = await signAndExecuteFeature.signAndExecuteTransactionBlock(
      {
        transactionBlock,
        account: accounts[0],
        chain: "sui:mainnet",
        options: {
          showEffects: true,
          showEvents: true,
        },
      }
    );

    return response;
  };

  // Connect to Sui Mate Wallet via WebSocket
  const connectToMateWallet = async () => {
    try {
      setConnecting(true);

      // Connect to WebSocket server
      const ws = new WebSocket("ws://localhost:3001");

      // Wait for WebSocket to open
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = (error) => reject(error);
      });

      // Request connection key
      ws.send(
        JSON.stringify({
          id: "req-" + Date.now(),
          method: "requestConnectionKey",
          params: {},
        })
      );

      // Wait for key response
      const response = await new Promise<any>((resolve, reject) => {
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            resolve(data);
          } catch (error) {
            reject(error);
          }
        };
        ws.onerror = (error) => reject(error);
      });

      // Close WebSocket
      ws.close();

      if (response.error) {
        throw new Error(
          response.error.message || "Failed to get connection key"
        );
      }

      const key = response.result;
      setConnectionKey(key);

      // Open the connect page in a popup
      const connectUrl = `${window.location.origin}/connect?key=${key}`;
      window.open(connectUrl, "SuiMateWalletConnect", "width=500,height=700");

      // Listen for connection message
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === "sui-mate-wallet-connected") {
          console.log("Received connection from popup:", event.data);
          setConnected(true);
          setConnecting(false);
          window.removeEventListener("message", handleMessage);
        }
      };

      window.addEventListener("message", handleMessage);
    } catch (error) {
      console.error("Error connecting to Sui Mate Wallet:", error);
      setConnecting(false);
    }
  };

  const value = {
    wallets,
    selectedWallet,
    accounts,
    connecting,
    connected,
    connectionKey,
    connectWallet,
    disconnectWallet,
    signAndExecuteTransactionBlock,
    connectToMateWallet,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
};

// Custom hook to use the wallet context
export const useWallet = () => useContext(WalletContext);
