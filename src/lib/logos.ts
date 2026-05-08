// Logos served by DeFiLlama's icon CDN.
//   tokens: https://token-icons.llamao.fi/icons/tokens/<chainId>/<lowercase-address>?h=48&w=48
//   chains: https://icons.llamao.fi/icons/chains/rsz_<slug>?w=48&h=48
//
// Note the different subdomains — `token-icons.llamao.fi` for tokens (chainId-keyed,
// any address), `icons.llamao.fi` for chains (slug-keyed). The token endpoint always
// returns *something* (placeholder image for unknown tokens) so onError is rare.
// Chains slug map covers all 17 deployments; if a slug is wrong on DeFiLlama's end
// the <Logo> onError falls back to the neutral placeholder.

const TOKEN_BASE = "https://token-icons.llamao.fi/icons/tokens";
const CHAIN_BASE = "https://icons.llamao.fi/icons/chains";

// chainId -> DeFiLlama chain slug. null = no slug known yet (placeholder rendered).
const CHAIN_SLUG: Record<number, string | null> = {
  1: "ethereum",
  8453: "base",
  42161: "arbitrum",
  43114: "avax",
  59144: "linea",
  10: "optimism",
  56: "bsc",
  100: "xdai",
  137: "polygon",
  146: "sonic",
  4326: "megaeth",
  42220: "celo",
  5000: "mantle",
  196: "xlayer",
  9745: "plasma",
};

export function chainLogoUrl(chainId: number): string | null {
  const slug = CHAIN_SLUG[chainId];
  return slug ? `${CHAIN_BASE}/rsz_${slug}?w=48&h=48` : null;
}

export function tokenLogoUrl(chainId: number, address: string): string {
  return `${TOKEN_BASE}/${chainId}/${address.toLowerCase()}?h=48&w=48`;
}
