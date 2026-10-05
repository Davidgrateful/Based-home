// On-chain hookup: Robinhood Chain Testnet (the network vibe/vibe runs on).
// The game token is an ERC-20 launched on https://testnet.vibevibe.fun/create.
// Holding any amount unlocks the "Rift-Bound" perk in game; at the end of a
// run the player can sign their result with their wallet as a proof of play.

import {
  type Address,
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  isAddress,
} from "viem";

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: {
    default: { name: "Robinhood Explorer", url: "https://explorer.testnet.chain.robinhood.com" },
  },
  testnet: true,
});

export const LINKS = {
  site: "https://testnet.vibevibe.fun",
  create: "https://testnet.vibevibe.fun/create",
  faucet: "https://faucet.testnet.chain.robinhood.com",
  token: (a: string) => `https://testnet.vibevibe.fun/t/${a}`,
  explorerAddr: (a: string) => `https://explorer.testnet.chain.robinhood.com/address/${a}`,
};

/** Token address: `?token=0x…` in the URL wins, then VITE_TOKEN_ADDRESS. */
function configuredToken(): Address | null {
  const fromUrl = new URLSearchParams(location.search).get("token");
  const raw = fromUrl || (import.meta.env.VITE_TOKEN_ADDRESS as string | undefined) || "";
  return isAddress(raw.trim()) ? getAddress(raw.trim()) : null;
}

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
const eth = (): Eip1193 | undefined => (window as unknown as { ethereum?: Eip1193 }).ethereum;

export interface TokenInfo {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
}

export class TokenLink {
  readonly tokenAddress = configuredToken();
  readonly publicClient = createPublicClient({ chain: robinhoodTestnet, transport: http() });
  info: TokenInfo | null = null;
  account: Address | null = null;
  balance = 0n;
  onChange?: () => void;

  get hasWallet() {
    return !!eth();
  }
  get holder() {
    return this.balance > 0n;
  }
  get balanceText() {
    if (!this.info) return "0";
    const n = Number(formatUnits(this.balance, this.info.decimals));
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  async loadInfo() {
    if (!this.tokenAddress) return;
    try {
      const c = { address: this.tokenAddress, abi: erc20Abi } as const;
      const [name, symbol, decimals] = await Promise.all([
        this.publicClient.readContract({ ...c, functionName: "name" }),
        this.publicClient.readContract({ ...c, functionName: "symbol" }),
        this.publicClient.readContract({ ...c, functionName: "decimals" }),
      ]);
      this.info = { address: this.tokenAddress, name, symbol, decimals };
    } catch (e) {
      console.warn("[token] could not read token metadata", e);
    }
    this.onChange?.();
  }

  async connect(): Promise<string | null> {
    const provider = eth();
    if (!provider) return "No wallet found. Install MetaMask, Rabby or another browser wallet.";
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      this.account = getAddress(accounts[0]);
      await this.ensureChain(provider);
      await this.refresh();
      return null;
    } catch (e) {
      return (e as Error).message?.split("\n")[0] ?? "Wallet connection failed";
    }
  }

  private async ensureChain(provider: Eip1193) {
    const hex = `0x${robinhoodTestnet.id.toString(16)}`;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e) {
      if ((e as { code?: number }).code !== 4902) throw e;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hex,
            chainName: robinhoodTestnet.name,
            nativeCurrency: robinhoodTestnet.nativeCurrency,
            rpcUrls: robinhoodTestnet.rpcUrls.default.http,
            blockExplorerUrls: [robinhoodTestnet.blockExplorers.default.url],
          },
        ],
      });
    }
  }

  async refresh() {
    if (!this.account || !this.tokenAddress) {
      this.onChange?.();
      return;
    }
    try {
      this.balance = await this.publicClient.readContract({
        address: this.tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [this.account],
      });
    } catch (e) {
      console.warn("[token] balance read failed", e);
    }
    this.onChange?.();
  }

  /** Wallet-signed proof of a finished run (no gas, no transaction). */
  async signRun(stats: { shards: number; kills: number; seconds: number; night: number; echoes: number }): Promise<string> {
    const provider = eth();
    if (!provider || !this.account) throw new Error("Connect a wallet first");
    const wallet = createWalletClient({ account: this.account, chain: robinhoodTestnet, transport: custom(provider) });
    const msg = [
      "AFTERFALL · proof of survival",
      `Rift Shards: ${stats.shards}`,
      `Best Long Night: ${stats.night}`,
      `Echoes recovered: ${stats.echoes}/12`,
      `Hollow defeated: ${stats.kills}`,
      `Time: ${stats.seconds}s`,
      `Token: ${this.tokenAddress ?? "not launched"}`,
      `Chain: ${robinhoodTestnet.id}`,
      `Date: ${new Date().toISOString()}`,
    ].join("\n");
    return wallet.signMessage({ account: this.account, message: msg });
  }
}
