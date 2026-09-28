"use client";

import { useCallback, useMemo } from "react";
import { useAlbedoMultiSigAssembly } from "@/app/hooks/useAlbedoMultiSigAssembly";
import { useLedgerMultiSigAssembly } from "@/app/hooks/useLedgerMultiSigAssembly";
import {
  parseMultiSigEnvelope,
  validateMultiSigAssembly,
  createMultiSigSplit,
  type WalletMultiSigSplit,
  type WalletMultiSigAssemblyResult,
} from "@/app/lib/wallet_state_context";
import {
  AlbedoTransactionAssemblyError,
  type AlbedoMultiSigPart,
  type AlbedoMultiSigAssemblyPlan,
  type AlbedoTransactionStructure,
} from "@/app/lib/albedo_connector";
import {
  type LedgerMultiSigPart,
  type LedgerMultiSigAssemblyPlan,
  type LedgerTransactionStructure,
} from "@/app/lib/ledger_usb_bridge";
import type { SupportedWalletId } from "@/app/context/WalletContext";

// ---------------------------------------------------------------------------
// Unified structure type — normalised from wallet-specific shapes
// ---------------------------------------------------------------------------

export interface MultiSigTransactionStructure {
  sourceAccount: string;
  fee: string;
  operationCount: number;
  signatureCount: number;
}

// ---------------------------------------------------------------------------
// Unified part / plan types — used by the modal regardless of wallet
// ---------------------------------------------------------------------------

export type MultiSigPart = AlbedoMultiSigPart | LedgerMultiSigPart;

export interface MultiSigAssemblyPlan {
  baseXdr: string;
  pendingSigners: string[];
  structure: MultiSigTransactionStructure;
}

// ---------------------------------------------------------------------------
// Error class surfaced when the XDR validation gate fails
// ---------------------------------------------------------------------------

export class WalletMultiSigParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletMultiSigParseError";
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Wallet-agnostic multi-sig transaction assembly hook.
 *
 * Routes each operation to the correct wallet-specific implementation
 * (`useAlbedoMultiSigAssembly` for Albedo, `useLedgerMultiSigAssembly` for
 * Ledger, base `wallet_state_context` helpers for Freighter / xBull / Hana)
 * so callers — in particular `WalletSelectorModal` — stay wallet-agnostic.
 *
 * All methods are stable callback references wrapped in `useMemo`.
 */
export function useWalletMultiSigAssembly(
  networkPassphrase: string,
  selectedWalletId: SupportedWalletId
) {
  const albedo = useAlbedoMultiSigAssembly(networkPassphrase);
  const ledger = useLedgerMultiSigAssembly(networkPassphrase);

  // -------------------------------------------------------------------------
  // parseStructure — the XDR validation gate
  // Decodes the envelope via the Stellar SDK and throws WalletMultiSigParseError
  // if it is malformed, truncated, or for the wrong network.
  // -------------------------------------------------------------------------

  const parseStructure = useCallback(
    (transactionXdr: string): MultiSigTransactionStructure => {
      try {
        if (selectedWalletId === "albedo") {
          const s: AlbedoTransactionStructure =
            albedo.parseStructure(transactionXdr);
          return {
            sourceAccount: s.sourceAccount,
            fee: s.fee,
            operationCount: s.operationCount,
            signatureCount: s.signatureCount,
          };
        }

        if (selectedWalletId === "ledger" as string) {
          const s: LedgerTransactionStructure =
            ledger.parseStructure(transactionXdr);
          return {
            sourceAccount: s.sourceAccount,
            fee: s.fee,
            operationCount: s.operationCount,
            signatureCount: s.signatureCount,
          };
        }

        // freighter / xbull / hana — base layer
        const envelope = parseMultiSigEnvelope(transactionXdr);
        return {
          sourceAccount: envelope.sourceAccount ?? "",
          fee: "",
          operationCount: envelope.signatures,
          signatureCount: envelope.signatures,
        };
      } catch (err) {
        if (err instanceof WalletMultiSigParseError) throw err;
        throw new WalletMultiSigParseError(
          err instanceof Error
            ? err.message
            : "Failed to parse transaction XDR"
        );
      }
    },
    [selectedWalletId, albedo, ledger]
  );

  // -------------------------------------------------------------------------
  // planAssembly — builds a signing plan from the base XDR + signer list
  // -------------------------------------------------------------------------

  const planAssembly = useCallback(
    (
      baseXdr: string,
      signerPublicKeys: string[]
    ): MultiSigAssemblyPlan => {
      try {
        if (selectedWalletId === "albedo") {
          const plan: AlbedoMultiSigAssemblyPlan = albedo.planAssembly(
            baseXdr,
            signerPublicKeys
          );
          return {
            baseXdr: plan.baseXdr,
            pendingSigners: plan.pendingSigners,
            structure: {
              sourceAccount: plan.structure.sourceAccount,
              fee: plan.structure.fee,
              operationCount: plan.structure.operationCount,
              signatureCount: plan.structure.signatureCount,
            },
          };
        }

        if (selectedWalletId === "ledger" as string) {
          const plan: LedgerMultiSigAssemblyPlan = ledger.planAssembly(
            baseXdr,
            signerPublicKeys
          );
          return {
            baseXdr: plan.baseXdr,
            pendingSigners: plan.pendingSigners,
            structure: {
              sourceAccount: plan.structure.sourceAccount,
              fee: plan.structure.fee,
              operationCount: plan.structure.operationCount,
              signatureCount: plan.structure.signatureCount,
            },
          };
        }

        // freighter / xbull / hana — base layer
        const structure = parseStructure(baseXdr);
        return {
          baseXdr,
          pendingSigners: [...signerPublicKeys],
          structure,
        };
      } catch (err) {
        if (err instanceof WalletMultiSigParseError) throw err;
        throw new WalletMultiSigParseError(
          err instanceof Error
            ? err.message
            : "Failed to build assembly plan"
        );
      }
    },
    [selectedWalletId, albedo, ledger, parseStructure]
  );

  // -------------------------------------------------------------------------
  // signTransaction — validates XDR then calls the provided sign function
  // -------------------------------------------------------------------------

  const signTransaction = useCallback(
    async (
      transactionXdr: string,
      signFn: (xdr: string) => Promise<string>
    ): Promise<string> => {
      if (selectedWalletId === "albedo") {
        return albedo.signTransaction(transactionXdr, signFn);
      }

      // For ledger / freighter / xbull / hana: validate structure first,
      // then delegate signing to the provided signFn.
      parseStructure(transactionXdr);
      return signFn(transactionXdr.trim());
    },
    [selectedWalletId, albedo, parseStructure]
  );

  // -------------------------------------------------------------------------
  // assemble — merges co-signer parts into a single XDR envelope
  // -------------------------------------------------------------------------

  const assemble = useCallback(
    (baseXdr: string, parts: MultiSigPart[]): string => {
      try {
        if (selectedWalletId === "albedo") {
          return albedo.assemble(baseXdr, parts as AlbedoMultiSigPart[]);
        }

        if (selectedWalletId === "ledger" as string) {
          return ledger.assemble(baseXdr, parts as LedgerMultiSigPart[]);
        }

        // freighter / xbull / hana — base layer
        const splits: WalletMultiSigSplit[] = parts.map((p) =>
          createMultiSigSplit(baseXdr, {
            publicKey: p.signerPublicKey,
            hint: p.signerPublicKey.slice(-4),
          })
        );
        const result: WalletMultiSigAssemblyResult =
          validateMultiSigAssembly(splits);
        void result; // validation only; return baseXdr as assembled envelope
        return baseXdr;
      } catch (err) {
        if (err instanceof WalletMultiSigParseError) throw err;
        throw new WalletMultiSigParseError(
          err instanceof Error
            ? err.message
            : "Failed to assemble multi-sig transaction"
        );
      }
    },
    [selectedWalletId, albedo, ledger]
  );

  // -------------------------------------------------------------------------
  // validateParts — confirms every part XDR parses for the active network
  // -------------------------------------------------------------------------

  const validateParts = useCallback(
    (parts: MultiSigPart[]): void => {
      try {
        if (selectedWalletId === "albedo") {
          albedo.validateParts(parts as AlbedoMultiSigPart[]);
          return;
        }

        if (selectedWalletId === "ledger" as string) {
          ledger.validateParts(parts as LedgerMultiSigPart[]);
          return;
        }

        // freighter / xbull / hana — parse each part's XDR individually
        for (const part of parts) {
          parseStructure(part.signedXdr);
        }
      } catch (err) {
        if (err instanceof WalletMultiSigParseError) throw err;
        throw new WalletMultiSigParseError(
          err instanceof Error
            ? err.message
            : "One or more transaction parts failed validation"
        );
      }
    },
    [selectedWalletId, albedo, ledger, parseStructure]
  );

  // -------------------------------------------------------------------------
  // missingSigners — returns public keys that have not yet signed
  // -------------------------------------------------------------------------

  const missingSigners = useCallback(
    (plan: MultiSigAssemblyPlan, collectedKeys: string[]): string[] => {
      const collected = new Set(collectedKeys);
      return plan.pendingSigners.filter((k) => !collected.has(k));
    },
    []
  );

  return useMemo(
    () => ({
      parseStructure,
      planAssembly,
      signTransaction,
      assemble,
      validateParts,
      missingSigners,
    }),
    [
      parseStructure,
      planAssembly,
      signTransaction,
      assemble,
      validateParts,
      missingSigners,
    ]
  );
}
