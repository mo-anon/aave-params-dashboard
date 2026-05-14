export type Deployment = {
  name: string;
  chainId: number;
  pool: `0x${string}`;
  riskSteward: `0x${string}`;
  riskCouncilSafe: `0x${string}`;
  /** Multicall3 address. Canonical 0xcA11... on most chains; override for outliers. */
  multicall3: `0x${string}`;
  /**
   * Block explorer base URL — kept WITH trailing slash so it joins as
   * `${explorer}address/${hash}` (matches curvefi/curve-frontend's `scanAddressPath` pattern).
   * `null` for chains where no canonical explorer is known.
   */
  explorer: string | null;
  /**
   * Default public RPC URL — CORS-friendly, free-tier endpoint. Used when the
   * user hasn't supplied their own RPC for this chain. `null` means no public
   * default is shipped and the user must paste a URL.
   */
  defaultRpc: string | null;
};

// Horizon is a separate, licensed Aave instance (v3.3 fork) for permissioned RWA
// collateral. It deliberately ships *without* a RiskSteward — parameter changes
// happen via the standard PoolConfigurator path under Aave Labs (executive role)
// and Aave DAO (operational role). So no bounds / cooldowns / restriction list
// to read; the dashboard shows the live config straight from the pool.
export type HorizonDeployment = {
  name: string;
  chainId: number;
  pool: `0x${string}`;
  poolConfigurator: `0x${string}`;
  aclManager: `0x${string}`;
  aclAdmin: `0x${string}`;
  multicall3: `0x${string}`;
  explorer: string | null;
  defaultRpc: string | null;
};

const CANONICAL_MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

const RISK_COUNCIL_ETHEREUM = "0x47c71dFEB55Ebaa431Ae3fbF99Ea50e0D3d30fA8" as const;

export const DEPLOYMENTS: Deployment[] = [
  {
    name: "AaveV3Ethereum",
    chainId: 1,
    pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    riskSteward: "0xFCE597866Ffaf617EFdcA1C1Ad50eBCB16B5171E",
    riskCouncilSafe: RISK_COUNCIL_ETHEREUM,
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://etherscan.io/",
    defaultRpc: "https://eth.drpc.org",
  },
  {
    name: "AaveV3EthereumLido",
    chainId: 1,
    pool: "0x4e033931ad43597d96D6bcc25c280717730B58B1",
    riskSteward: "0x7e6a6B115D31d4A837E3C737c49Cf6Fafe6112C3",
    riskCouncilSafe: RISK_COUNCIL_ETHEREUM,
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://etherscan.io/",
    defaultRpc: "https://eth.drpc.org",
  },
  {
    name: "AaveV3EthereumEtherFi",
    chainId: 1,
    pool: "0x0AA97c284e98396202b6A04024F5E2c65026F3c0",
    riskSteward: "0xBF79d8339303148E345277a994Eb2cD5d82F0067",
    riskCouncilSafe: RISK_COUNCIL_ETHEREUM,
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://etherscan.io/",
    defaultRpc: "https://eth.drpc.org",
  },
  {
    name: "AaveV3Base",
    chainId: 8453,
    pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    riskSteward: "0x085E34722e04567Df9E6d2c32e82fd74f3342e79",
    riskCouncilSafe: "0xfbeB4AcB31340bA4de9C87B11dfBf7e2bc8C0bF1",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://basescan.org/",
    defaultRpc: "https://base.drpc.org",
  },
  {
    name: "AaveV3Arbitrum",
    chainId: 42161,
    pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    riskSteward: "0x365d47ceD3D7Eb6a9bdB3814aA23cc06B2D33Ef8",
    riskCouncilSafe: "0x3Be327F22eB4BD8042e6944073b8826dCf357Aa2",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://arbiscan.io/",
    defaultRpc: "https://arbitrum.drpc.org",
  },
  {
    name: "AaveV3Avalanche",
    chainId: 43114,
    pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    riskSteward: "0x23AceD103f5E22bD22B9272c82f29C0E51abC5c2",
    riskCouncilSafe: "0xCa66149425E7DC8f81276F6D80C4b486B9503D1a",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://snowscan.xyz/",
    defaultRpc: "https://avalanche.drpc.org",
  },
  {
    name: "AaveV3Linea",
    chainId: 59144,
    pool: "0xc47b8C00b0f69a36fa203Ffeac0334874574a8Ac",
    riskSteward: "0xBDF2e1A49894A306Eb76b89504928b3f509A3a16",
    riskCouncilSafe: "0xF092A5aC5E284E7c433dAFE5b8B138bFcA53a4Ee",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://lineascan.build/",
    defaultRpc: "https://linea.drpc.org",
  },
  {
    name: "AaveV3Optimism",
    chainId: 10,
    pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    riskSteward: "0xa59262276dB8F997948fdc4a10cBc1448A375636",
    riskCouncilSafe: "0xCb86256A994f0c505c5e15c75BF85fdFEa0F2a56",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://optimistic.etherscan.io/",
    defaultRpc: "https://optimism.drpc.org",
  },
  {
    name: "AaveV3BNB",
    chainId: 56,
    pool: "0x6807dc923806fE8Fd134338EABCA509979a7e0cB",
    riskSteward: "0x87F4aDD5425f566F156af5074BaD2dFFCd20C594",
    riskCouncilSafe: "0x126dc589cc75f17385dD95516F3F1788d862E7bc",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://bscscan.com/",
    defaultRpc: "https://bsc.drpc.org",
  },
  {
    name: "AaveV3Gnosis",
    chainId: 100,
    pool: "0xb50201558B00496A145fE76f7424749556E326D8",
    riskSteward: "0x1AA25FdD7d55FA8a401D6EFba8e48874Ef730E55",
    riskCouncilSafe: "0xF221B08dD10e0C68D74F035764931Baa3b030481",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://gnosisscan.io/",
    defaultRpc: "https://gnosis.drpc.org",
  },
  {
    name: "AaveV3Polygon",
    chainId: 137,
    pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    riskSteward: "0x1e0A5985D58B45C38598e293189aa5228054629b",
    riskCouncilSafe: "0x2C40FB1ACe63084fc0bB95F83C31B5854C6C4cB5",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://polygonscan.com/",
    defaultRpc: "https://polygon.drpc.org",
  },
  {
    name: "AaveV3Sonic",
    chainId: 146,
    pool: "0x5362dBb1e601abF3a4c14c22ffEdA64042E5eAA3",
    riskSteward: "0xdb93e2712a8B36835078f8D28c70fCC95FD6d37c",
    riskCouncilSafe: "0x1dE39A17a9Fa8c76899fff37488482EEb7835d04",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://sonicscan.org/",
    defaultRpc: "https://sonic.drpc.org",
  },
  {
    name: "AaveV3MegaEth",
    chainId: 4326,
    pool: "0x7e324AbC5De01d112AfC03a584966ff199741C28",
    riskSteward: "0xbcC2Cf1fA3bE94B16061d51970628a87c7Cd5160",
    riskCouncilSafe: "0x36CF7a4377aAf1988E01a4b38224FC8D583E50A9",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://mega.etherscan.io/",
    defaultRpc: "https://megaeth.drpc.org",
  },
  {
    name: "AaveV3Celo",
    chainId: 42220,
    pool: "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402",
    riskSteward: "0xdb93e2712a8B36835078f8D28c70fCC95FD6d37c",
    riskCouncilSafe: "0xd85786B5FC61E2A0c0a3144a33A0fC70646a99f6",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://celoscan.io/",
    defaultRpc: "https://celo.drpc.org",
  },
  {
    name: "AaveV3Mantle",
    chainId: 5000,
    pool: "0x458F293454fE0d67EC0655f3672301301DD51422",
    riskSteward: "0xa35358159F42E11C5689C68f181a71d51BB22de3",
    riskCouncilSafe: "0xfF0ACe5060bd25f6900eb4bD91a868213C5346B5",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://mantlescan.xyz/",
    defaultRpc: "https://mantle.drpc.org",
  },
  {
    name: "AaveV3XLayer",
    chainId: 196,
    pool: "0xE3F3Caefdd7180F884c01E57f65Df979Af84f116",
    riskSteward: "0xb5970A521073ADE4836dD4A24854Eb387a67c5C8",
    riskCouncilSafe: "0xa43F8eDf0a0aE07e951bca11162625e77e7609A1",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://www.okx.com/web3/explorer/xlayer/",
    defaultRpc: "https://xlayerrpc.okx.com",
  },
  {
    name: "AaveV3Plasma",
    chainId: 9745,
    pool: "0x925a2A7214Ed92428B5b1B090F80b25700095e12",
    riskSteward: "0x98F756B77D6Fde14E08bb064b248ec7512F9f8ba",
    riskCouncilSafe: "0xE71C189C7D8862EfDa0D9E031157199D2F3B4893",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://plasmascan.to/",
    defaultRpc: "https://rpc.plasma.to",
  },
];

// Aave Horizon deployments. Only Ethereum mainnet for now (only deployment that
// exists). Addresses sourced from bgd-labs/aave-address-book → AaveV3EthereumHorizon.sol.
export const HORIZON_DEPLOYMENTS: HorizonDeployment[] = [
  {
    name: "AaveV3EthereumHorizon",
    chainId: 1,
    pool: "0xAe05Cd22df81871bc7cC2a04BeCfb516bFe332C8",
    poolConfigurator: "0x83Cb1B4af26EEf6463aC20AFbAC9c0e2E017202F",
    aclManager: "0xEFD5df7b87d2dCe6DD454b4240b3e0A4db562321",
    aclAdmin: "0x5300A1a15135EA4dc7aD5a167152C01EFc9b192A",
    multicall3: CANONICAL_MULTICALL3,
    explorer: "https://etherscan.io/",
    defaultRpc: "https://eth.drpc.org",
  },
];

// Match curvefi/curve-frontend's `scanAddressPath` join: explorer URLs are stored
// with a trailing slash, so we just append `address/<hash>` directly (no extra slash).
export function explorerAddressUrl(
  d: { explorer: string | null },
  address: string,
): string | null {
  return d.explorer ? `${d.explorer}address/${address}` : null;
}
