import { useState, useEffect, useCallback, useRef } from 'react';
import { TonConnectUI } from '@tonconnect/ui';

// Singleton instance - lazily initialized on demand
let tonConnectInstance: TonConnectUI | null = null;

function getTonConnect(): TonConnectUI {
  if (!tonConnectInstance) {
    const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://super-tom.vercel.app';
    const manifestUrl = `${origin}/tonconnect-manifest.json`;
    tonConnectInstance = new TonConnectUI({ manifestUrl });
  }
  return tonConnectInstance;
}

// Network chain IDs
const MAINNET_CHAIN = '-239';
const TESTNET_CHAIN = '-3';

/**
 * Encodes a UTF-8 text comment into a standard single-cell TON BOC in base64.
 * Op code 0x00000000 indicates a standard text comment.
 * Pure browser-compatible implementation without external dependencies.
 */
export function buildCommentBocBase64(comment: string): string {
  if (!comment) return '';
  const textEncoder = new TextEncoder();
  const textBytes = textEncoder.encode(comment);
  const dataLen = 4 + textBytes.length; // 4 zero bytes prefix
  const d1 = 0; // 0 refs, not exotic
  const d2 = dataLen * 2; // (dataLen * 8) / 8 * 2 = dataLen * 2 (no padding bit)
  const cellData = [d1, d2, 0, 0, 0, 0, ...Array.from(textBytes)];
  const totCellsSize = cellData.length;
  // flags: has_idx=0, has_crc32c=0, has_cache_bits=0, size_bytes=1 -> 0x01
  const header = [0xb5, 0xee, 0x9c, 0x72, 0x01, 0x01, 0x01, 0x01, 0x00, totCellsSize, 0x00];
  const allBytes = new Uint8Array([...header, ...cellData]);

  let binary = '';
  for (let i = 0; i < allBytes.length; i++) {
    binary += String.fromCharCode(allBytes[i]);
  }
  return btoa(binary);
}

export function useTonConnect(enabled: boolean = false) {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<'mainnet' | 'testnet' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Lazily get/create the singleton and subscribe to wallet status when enabled
  useEffect(() => {
    if (!enabled && !tonConnectInstance) {
      return;
    }

    const tc = getTonConnect();

    // Subscribe to wallet status changes
    const unsubscribe = tc.onStatusChange((wallet) => {
      if (wallet) {
        setIsConnected(true);
        const friendlyAddr = wallet.account.address;
        setWalletAddress(friendlyAddr);

        const chain = wallet.account.chain;
        if (chain === MAINNET_CHAIN) {
          setNetwork('mainnet');
        } else if (chain === TESTNET_CHAIN) {
          setNetwork('testnet');
        } else {
          setNetwork(null);
        }
      } else {
        setIsConnected(false);
        setWalletAddress(null);
        setNetwork(null);
      }
    });

    unsubscribeRef.current = unsubscribe;

    // Sync initial wallet state (handles persisted connection across reloads)
    if (tc.wallet) {
      setIsConnected(true);
      setWalletAddress(tc.wallet.account.address);
      const chain = tc.wallet.account.chain;
      if (chain === MAINNET_CHAIN) {
        setNetwork('mainnet');
      } else if (chain === TESTNET_CHAIN) {
        setNetwork('testnet');
      }
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [enabled]);

  const connectWallet = useCallback(async (): Promise<void> => {
    setError(null);
    setIsLoading(true);
    try {
      const tc = getTonConnect();
      await tc.connectWallet();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect wallet.';
      if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('cancelled')) {
        setError('Connection cancelled by user.');
      } else if (msg.toLowerCase().includes('not installed') || msg.toLowerCase().includes('not found')) {
        setError('No TON wallet found. Please install Tonkeeper or another TON wallet.');
      } else {
        setError(msg);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnectWallet = useCallback(async (): Promise<void> => {
    setError(null);
    setIsLoading(true);
    try {
      const tc = getTonConnect();
      await tc.disconnect();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to disconnect wallet.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendTonTransaction = useCallback(
    async (toAddress: string, nanoTon: string, comment: string): Promise<string | null> => {
      setError(null);
      setIsLoading(true);
      try {
        const tc = getTonConnect();

        if (!tc.wallet) {
          throw new Error('Wallet not connected. Please connect your wallet first.');
        }

        // Network check
        const chain = tc.wallet.account.chain;
        if (chain !== MAINNET_CHAIN) {
          throw new Error('Wrong network: Please switch your wallet to TON Mainnet.');
        }

        const payload = comment ? buildCommentBocBase64(comment) : undefined;

        const result = await tc.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
          messages: [
            {
              address: toAddress,
              amount: nanoTon,
              payload,
            },
          ],
        });

        return result.boc; // base64 BOC string
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Transaction failed.';
        if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('cancel')) {
          setError('Transaction cancelled by user.');
        } else if (msg.toLowerCase().includes('wrong network') || msg.toLowerCase().includes('mainnet')) {
          setError('Wrong network. Please switch to TON Mainnet.');
        } else {
          setError(msg);
        }
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isConnected,
    walletAddress,
    network,
    isLoading,
    error,
    connectWallet,
    disconnectWallet,
    sendTonTransaction,
  };
}
