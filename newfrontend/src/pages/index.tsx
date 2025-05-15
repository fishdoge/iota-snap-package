import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import {
  ConnectModal,
  useCurrentAccount,
  useCurrentWallet,
  useSignPersonalMessage,
  useSignAndExecuteTransaction,
  useIotaClientQuery,
  useIotaClientContext,
} from "@iota/dapp-kit";
import { metaMaskAvailable } from "@/iota-snap-wallet";
import { registerIotaMateWallet } from "@/iota-mate-wallet";
import { Transaction } from "@iota/iota-sdk/transactions";
import { IOTA_DECIMALS } from "@iota/iota-sdk/utils";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DialogContent } from "@/components/ui/dialog";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {
  const [error, setError] = useState<string | undefined>(undefined);
  const [flaskInstalled, setFlaskInstalled] = useState<boolean>(false);
  const [signatureResult, setSignatureResult] = useState<string | null>(null);
  const [qrCodeKey, setQrCodeKey] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [waitingForConnection, setWaitingForConnection] = useState(false);

  // Transfer
  const [amount, setAmount] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const popupRef = useRef<Window | null>(null);

  const { isConnected, currentWallet } = useCurrentWallet();
  const currentAccount = useCurrentAccount();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  const { mutateAsync: signAndExecuteTransaction } =
    useSignAndExecuteTransaction();

  const ctx = useIotaClientContext();

  // console.log("Current Account", currentAccount);
  console.log("Context", ctx);
  const {
    data: balance,
    isPending,
    isError,
    refetch,
  } = useIotaClientQuery(
    "getBalance",
    { owner: currentAccount?.address! },
    {
      gcTime: 10000,
    }
  );

  console.log(balance);

  // Check if MetaMask is available and register wallets
  useEffect(() => {
    const checkMetaMaskAndRegisterWallets = async () => {
      try {
        const metaMaskState = await metaMaskAvailable();
        setFlaskInstalled(metaMaskState.available);

        // Register Iota Mate Wallet
        registerIotaMateWallet();
      } catch (e) {
        setFlaskInstalled(false);
        console.error(e);
      }
    };

    checkMetaMaskAndRegisterWallets();
  }, []);

  // Listen for messages from the popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "iota-mate-wallet-connected") {
        console.log("Received connection from popup:", event.data);
        setWaitingForConnection(false);
        setQrCodeKey(null);
        setShowQrCode(false);
        // You can handle the successful connection here
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Close popup when component unmounts
  useEffect(() => {
    return () => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  const connectedToSnap =
    isConnected && currentWallet?.name === "Iota MetaMask Snap";

  const connectedToMateWallet =
    isConnected && currentWallet?.name === "Iota Mate Wallet";

  // Handle QR code generation
  const handleGenerateQrCode = async () => {
    try {
      // Connect to WebSocket server
      const ws = new WebSocket("ws://localhost:3001");

      // Wait for WebSocket to open
      await new Promise<void>((resolve) => {
        ws.onopen = () => resolve();
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
      const response = await new Promise<any>((resolve) => {
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          resolve(data);
        };
      });

      // Close WebSocket
      ws.close();

      if (response.error) {
        throw new Error(
          response.error.message || "Failed to get connection key"
        );
      }

      const key = response.result;
      setQrCodeKey(key);
      setShowQrCode(true);
      setWaitingForConnection(true);

      // Open the connect page in a popup
      const connectUrl = `${window.location.origin}/connect?key=${key}`;
      popupRef.current = window.open(
        connectUrl,
        "IotaMateWalletConnect",
        "width=500,height=700"
      );
    } catch (error) {
      console.error("Error generating QR code:", error);
      setError((error as Error).message);
    }
  };

  const handleConnectError = (error: any) => {
    if (error) {
      if (typeof error === "string") {
        setError(error);
      } else {
        setError((error as Error).message);
      }
      console.error(error);
    }
  };

  const handleSignMessage = async () => {
    if (!(connectedToSnap || connectedToMateWallet) || !currentAccount) {
      return;
    }

    const messageText = connectedToMateWallet
      ? "Hello Iota Mate Wallet!"
      : "Hello Iota Snap!";

    signPersonalMessage(
      {
        message: new TextEncoder().encode(messageText),
        account: currentAccount,
      },
      {
        onSuccess: (result) => {
          console.log(result);
          setSignatureResult(JSON.stringify(result, null, 2));
        },
        onError: (e) => {
          if (typeof e === "string") {
            setError(e);
          } else {
            setError((e as Error).message);
          }
          console.error(e);
        },
      }
    );
  };

  const handleSignAndExecuteTransaction = async () => {
    if (!(connectedToSnap || connectedToMateWallet) || !currentAccount) {
      throw new Error("No wallet connected");
    }

    setIsTransferring(true);

    const tx = new Transaction();
    const coin = tx.splitCoins(tx.gas, [
      tx.pure.u64(Number(amount) * 10 ** IOTA_DECIMALS),
    ]);
    tx.transferObjects([coin], recipient);

    await signAndExecuteTransaction(
      {
        transaction: tx,
        chain: "iota:testnet",
      },
      {
        onSuccess: (result) => {
          console.log("executed transaction", result);
          setTxHash(result.digest);
          toast.success(
            `Transaction executed successfully: https://explorer.iota.org/txblock/${result.digest}?network=testnet`
          );
        },
        onError: (error) => {
          console.error(error);
          toast.error("Transaction failed");
        },
      }
    );

    setIsTransferring(false);
  };

  return (
    <div
      className={`${geistSans.className} ${geistMono.className} grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]`}
    >
      <main className="flex flex-col gap-[32px] row-start-2 items-center w-full max-w-3xl">
        <div className="flex flex-col items-center gap-4 w-full">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={180}
            height={38}
            priority
          />

          <h1 className="text-3xl font-bold mt-8 mb-4">
            Iota Wallet Demo Example
          </h1>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
            Connect to either Iota MetaMask Snap or Iota Mate Wallet
          </p>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 w-full">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {!flaskInstalled && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4 w-full">
              <strong className="font-bold">MetaMask Flask Required: </strong>
              <span className="block sm:inline">
                Iota Snap requires MetaMask Flask, a canary distribution for
                developers with access to upcoming features.
                <a
                  href="https://metamask.io/flask/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline ml-1"
                >
                  Install MetaMask Flask
                </a>
              </span>
            </div>
          )}

          <div className="flex flex-col gap-4 w-full">
            <ConnectModal
              trigger={
                <button className="px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed w-full">
                  Connect Wallet
                </button>
              }
            />

            <button
              onClick={handleGenerateQrCode}
              className="px-4 py-2 rounded-md bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed w-full"
              disabled={waitingForConnection}
            >
              {waitingForConnection
                ? "Waiting for Connection..."
                : "Connect with QR Code"}
            </button>

            {showQrCode && qrCodeKey && (
              <div className="bg-white p-4 rounded-md border border-gray-300 text-center">
                <h3 className="font-bold mb-2">Scan QR Code</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Scan this QR code with your mobile wallet or open it on
                  another device
                </p>
                <div className="flex justify-center mb-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      `${window.location.origin}/connect?key=${qrCodeKey}`
                    )}`}
                    alt="QR Code"
                    width={200}
                    height={200}
                  />
                </div>
                <div className="bg-gray-100 p-2 rounded text-xs font-mono break-all">
                  {qrCodeKey}
                </div>
              </div>
            )}

            {(connectedToSnap || connectedToMateWallet) && currentAccount && (
              <div className="flex flex-col gap-4 w-full">
                <div className="flex flex-col gap-2 bg-gray-500 p-4 rounded-md">
                  <h3 className="font-bold mb-2">Connected Account</h3>
                  <p className="text-sm mb-2">
                    <span className="font-semibold">Wallet:</span>{" "}
                    {currentWallet?.name}
                  </p>
                  <p className="font-mono text-sm break-all">
                    {currentAccount.address}
                  </p>
                  <p>
                    Balance:{" "}
                    {balance
                      ? Number(balance.totalBalance) / 10 ** IOTA_DECIMALS
                      : 0}{" "}
                    IOTA
                  </p>
                  <p>Network: {ctx.network}</p>
                </div>

                <div className="w-full flex gap-2">
                  <button
                    onClick={handleSignMessage}
                    className="flex-1 px-4 py-2 rounded-md bg-green-500 hover:bg-green-600 text-white"
                  >
                    Sign Message
                  </button>
                  <div className="flex-1">
                    <Dialog
                      onOpenChange={(open) => {
                        if (!open) {
                          setTxHash(null);
                        }
                      }}
                    >
                      <DialogTrigger className="w-full flex-1 px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white">
                        Transfer
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Transfer your token</DialogTitle>
                          <DialogDescription>
                            This action cannot be undone. This will permanently
                            delete your account and remove your data from our
                            servers.
                          </DialogDescription>
                          <Input
                            className="my-5"
                            type="number"
                            placeholder="Amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                          <Input
                            className="my-5"
                            type="text"
                            placeholder="Recipient"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                          />
                          <DialogFooter className="w-full flex justify-between">
                            <div className="flex-3">
                              {txHash && (
                                <a
                                  href={`https://explorer.iota.org/txblock/${txHash}?network=testnet`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-600"
                                >
                                  Tx Result
                                </a>
                              )}
                            </div>
                            <Button
                              className="flex-1"
                              onClick={handleSignAndExecuteTransaction}
                              disabled={isTransferring}
                            >
                              {isTransferring ? "Transferring..." : "Transfer"}
                            </Button>
                          </DialogFooter>
                        </DialogHeader>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {signatureResult && (
                  <div className="bg-gray-500p-4 rounded-md">
                    <h3 className="font-bold mb-2">Signature Result</h3>
                    <pre className="font-mono text-sm overflow-auto">
                      {signatureResult}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
