import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { useWallet } from "./contexts/WalletContext";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import Connect from "./pages/Connect";

const App: React.FC = () => {
  const {
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
  } = useWallet();

  const [transactionResult, setTransactionResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle wallet connection
  const handleConnectWallet = async (wallet: any) => {
    try {
      setError(null);
      await connectWallet(wallet);
    } catch (err) {
      setError(`Failed to connect: ${(err as Error).message}`);
      console.error(err);
    }
  };

  // Handle wallet disconnection
  const handleDisconnectWallet = () => {
    try {
      setError(null);
      disconnectWallet();
      setTransactionResult(null);
    } catch (err) {
      setError(`Failed to disconnect: ${(err as Error).message}`);
      console.error(err);
    }
  };

  // Handle connection to Sui Mate Wallet
  const handleConnectToMateWallet = async () => {
    try {
      setError(null);
      await connectToMateWallet();
    } catch (err) {
      setError(
        `Failed to connect to Sui Mate Wallet: ${(err as Error).message}`
      );
      console.error(err);
    }
  };

  // Execute a simple transaction
  const handleExecuteTransaction = async () => {
    try {
      setError(null);
      setTransactionResult(null);

      // Create a simple transaction block
      const txb = new TransactionBlock();

      // Add a simple transaction (this is just a dummy transaction)
      // In a real app, you would add actual transaction commands
      txb.moveCall({
        target: "0x2::sui::transfer",
        arguments: [txb.object("0x6"), txb.pure.address(accounts[0].address)],
      });

      // Sign and execute the transaction
      const result = await signAndExecuteTransactionBlock(txb);
      setTransactionResult(result);
    } catch (err) {
      setError(`Transaction failed: ${(err as Error).message}`);
      console.error(err);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Sui Mate Wallet Frontend</h1>
      </header>

      <Routes>
        <Route
          path="/"
          element={
            <div>
              {error && (
                <div className="alert">
                  <strong>Error:</strong> {error}
                </div>
              )}

              <div className="card">
                <h2>Connect to Wallet</h2>
                {!connected ? (
                  <div>
                    <button
                      className="button"
                      onClick={handleConnectToMateWallet}
                      disabled={connecting}
                    >
                      {connecting
                        ? "Connecting..."
                        : "Connect to Sui Mate Wallet"}
                    </button>

                    <h3>Available Wallets</h3>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {wallets.map((wallet) => (
                        <button
                          key={wallet.name}
                          className="button secondary"
                          onClick={() => handleConnectWallet(wallet)}
                          disabled={connecting}
                        >
                          Connect to {wallet.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="card">
                      <h3>Connected Wallet</h3>
                      <p>
                        <strong>Wallet:</strong> {selectedWallet?.name}
                      </p>
                      <p>
                        <strong>Account:</strong>{" "}
                        {accounts.length > 0
                          ? accounts[0].address
                          : "No accounts"}
                      </p>
                      {connectionKey && (
                        <p>
                          <strong>Connection Key:</strong> {connectionKey}
                        </p>
                      )}
                      <button
                        className="button danger"
                        onClick={handleDisconnectWallet}
                      >
                        Disconnect
                      </button>
                    </div>

                    <div className="card">
                      <h3>Execute Transaction</h3>
                      <button
                        className="button"
                        onClick={handleExecuteTransaction}
                        disabled={!connected}
                      >
                        Execute Simple Transaction
                      </button>
                    </div>

                    {transactionResult && (
                      <div className="card">
                        <h3>Transaction Result</h3>
                        <pre
                          style={{
                            background: "#f5f5f5",
                            padding: "10px",
                            borderRadius: "4px",
                            overflow: "auto",
                          }}
                        >
                          {JSON.stringify(transactionResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          }
        />
        <Route path="/connect" element={<Connect />} />
      </Routes>
    </div>
  );
};

export default App;
