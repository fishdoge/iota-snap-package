import {
  ExecuteTransactionRequestType,
  SuiTransactionBlockResponseOptions,
} from "@iota/sui.js/client";
import { TransactionBlock } from "@iota/sui.js/transactions";
import { fromB64, toB64 } from "@iota/sui.js/utils";
import {
  SuiSignAndExecuteTransactionBlockInput,
  SuiSignPersonalMessageInput,
  SuiSignTransactionBlockInput,
  WalletAccount,
  WalletIcon,
} from "@iota/wallet-standard";

/**
 * Passing in objects directly to the Snap sometimes doesn't work correctly so we need to serialize to primitive values
 * and then deserialize on the other side.
 */

/* ======== SerializedWalletAccount ======== */

export interface SerializedWalletAccount {
  address: string;
  publicKey: string;
  chains: string[];
  features: string[];
  label?: string;
  icon?: string;
}

export function serializeWalletAccount(
  account: WalletAccount
): SerializedWalletAccount {
  return {
    address: account.address,
    publicKey: toB64(account.publicKey as Uint8Array),
    features: [...account.features],
    chains: [...account.chains],
    label: account.label,
    icon: account.icon,
  };
}

export function deserializeWalletAccount(
  account: SerializedWalletAccount
): WalletAccount {
  return {
    address: account.address,
    publicKey: fromB64(account.publicKey),
    chains: account.chains.map((chain) => chain as `${string}:${string}`),
    features: account.features.map(
      (feature) => feature as `${string}:${string}`
    ),
    label: account.label,
    icon: account.icon as WalletIcon,
  };
}

/* ======== SerializedIotaSignMessageInput ======== */

export interface SerializedIotaSignMessageInput {
  message: string;
  account: SerializedWalletAccount;
}

export function serializeIotaSignMessageInput(
  input: SuiSignPersonalMessageInput
): SerializedIotaSignMessageInput {
  return {
    message: toB64(input.message),
    account: serializeWalletAccount(input.account),
  };
}

export function deserializeIotaSignMessageInput(
  input: SerializedIotaSignMessageInput
): SuiSignPersonalMessageInput {
  return {
    message: fromB64(input.message),
    account: deserializeWalletAccount(input.account),
  };
}

/* ======== SerializedIotaSignTransactionBlockInput ======== */

export interface SerializedIotaSignTransactionBlockInput {
  transactionBlock: string;
  account: SerializedWalletAccount;
  chain: string;
}

export function serializeIotaSignTransactionBlockInput(
  input: SuiSignTransactionBlockInput
): SerializedIotaSignTransactionBlockInput {
  return {
    transactionBlock: input.transactionBlock.serialize(),
    account: serializeWalletAccount(input.account),
    chain: input.chain,
  };
}

export function deserializeIotaSignTransactionBlockInput(
  input: SerializedIotaSignTransactionBlockInput
): SuiSignTransactionBlockInput {
  return {
    transactionBlock: TransactionBlock.from(input.transactionBlock) as any,
    account: deserializeWalletAccount(input.account),
    chain: input.chain as `${string}:${string}`,
  };
}

/* ======== SerializedIotaSignAndExecuteTransactionBlockInput ======== */

export interface SerializedIotaSignAndExecuteTransactionBlockInput {
  transactionBlock: string;
  account: SerializedWalletAccount;
  chain: string;
  requestType?: string;
  options?: SuiTransactionBlockResponseOptions;
}

export function serializeIotaSignAndExecuteTransactionBlockInput(
  input: SuiSignAndExecuteTransactionBlockInput
): SerializedIotaSignAndExecuteTransactionBlockInput {
  return {
    transactionBlock: input.transactionBlock.serialize(),
    account: serializeWalletAccount(input.account),
    chain: input.chain,
    requestType: input.requestType,
    options: input.options,
  };
}

export function deserializeIotaSignAndExecuteTransactionBlockInput(
  input: SerializedIotaSignAndExecuteTransactionBlockInput
): SuiSignAndExecuteTransactionBlockInput {
  return {
    ...input,
    transactionBlock: TransactionBlock.from(input.transactionBlock) as any,
    account: deserializeWalletAccount(input.account),
    chain: input.chain as `${string}:${string}`,
    requestType: input.requestType as ExecuteTransactionRequestType | undefined,
  };
}

/* ======== StoredState ======== */

export interface StoredState {
  mainnetUrl: string;
  testnetUrl: string;
  devnetUrl: string;
  localnetUrl: string;
}

/* ======== SerializedAdminSetFullnodeUrl ======== */

export interface SerializedAdminSetFullnodeUrl {
  network: "mainnet" | "testnet" | "devnet" | "localnet";
  url: string;
}
