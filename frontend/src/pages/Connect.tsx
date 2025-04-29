import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getWallets, Wallet, WalletAccount } from "@mysten/wallet-standard";

const Connect: React.FC = () => {
  const location = useLocation();
  const [key, setKey] = useState<string | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse the connection key from the URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const connectionKey = searchParams.get("key");
    if (connectionKey) {
      setKey(connectionKey);
    }
  }, [location.search]);

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
      setError(null);
      const features = wallet.features;

      if ("standard:connect" in features) {
        const connectFeature = features["standard:connect"];
        const response = await connectFeature.connect();
        setAccounts(response.accounts);
        setSelectedWallet(wallet);
        setConnected(true);

        // If we have a key, authenticate with the backend
        if (key && response.accounts.length > 0) {
          await authenticateConnection(key, response.accounts[0]);
        }
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setError((error as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  // Authenticate connection with the backend
  const authenticateConnection = async (
    key: string,
    account: WalletAccount
  ) => {
    try {
      // Connect to WebSocket server
      const ws = new WebSocket("ws://localhost:3001");

      // Wait for WebSocket to open
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = (error) => reject(error);
      });

      // Authenticate connection with the key
      ws.send(
        JSON.stringify({
          id: "auth-" + Date.now(),
          method: "authenticateConnection",
          params: {
            key: key,
            address: account.address,
            publicKey: account.publicKey
              ? btoa(String.fromCharCode(...new Uint8Array(account.publicKey)))
              : "",
            privateKey: "dummy-private-key", // We don't actually send the private key
          },
        })
      );

      // Wait for authentication response
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
        throw new Error(response.error.message || "Authentication failed");
      }

      // Notify the parent window
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "sui-mate-wallet-connected",
            address: account.address,
            publicKey: account.publicKey
              ? btoa(String.fromCharCode(...new Uint8Array(account.publicKey)))
              : "",
          },
          "*"
        );

        // Close this window after a short delay
        setTimeout(() => {
          window.close();
        }, 2000);
      }
    } catch (error) {
      console.error("Authentication error:", error);
      setError((error as Error).message);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Connect to Sui Mate Wallet</h1>
      </header>

      {error && (
        <div className="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {connected ? (
        <div className="alert success">
          <strong>Connected!</strong> You can close this window now.
        </div>
      ) : (
        <div className="card">
          <h2>Connect Your Wallet</h2>
          {key ? (
            <p>
              Connection Key: <code>{key}</code>
            </p>
          ) : (
            <p className="alert warning">No connection key provided.</p>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginTop: "20px",
            }}
          >
            {wallets.map((wallet) => (
              <button
                key={wallet.name}
                className="button"
                onClick={() => connectWallet(wallet)}
                disabled={connecting || connected}
              >
                {connecting ? "Connecting..." : `Connect to ${wallet.name}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Connect;
