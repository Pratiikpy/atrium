# Deployment registry, Arbitrum Sepolia

> This file is generated from `deployments/arbitrum_sepolia.json` by `scripts/generate-deployment-doc.mjs`. Do not edit by hand.

| Field | Value |
|-------|-------|
| Network | Arbitrum Sepolia |
| Chain ID | 421614 |
| RPC | `https://arbitrum-sepolia.publicnode.com` |
| Last updated | 2026-05-30T12:34:21.142Z |

## Stylus contracts

| Name | Address | Tx | Block | Kind | Version | Status | Sourcify | Notes |
|------|---------|-----|-------|------|---------|--------|----------|-------|
| coffer | [`0xc7bf0145…`](https://sepolia.arbiscan.io/address/0xc7bf0145371d3a79a9d43bab46dfee40f8a4aaf3) | [`0x07ae5e44…`](https://sepolia.arbiscan.io/tx/0x07ae5e44df7b6ada1a390af825389c8b37804421031f18f71490c2dee3a0e04b) | 270800974 | stylus | - | 🟢 live | ⚠️ Stylus | 2026-05-30 critical-fix redeploy. LIVE 2026-06-01: the 6 timelock ops executed a… |
| sigil | [`0xdba97d39…`](https://sepolia.arbiscan.io/address/0xdba97d39ff790e69c3526bb0c0b99a38f686d6d9) | [`0x1f7e8e32…`](https://sepolia.arbiscan.io/tx/0x1f7e8e3280a2ee279554cfe66d5efd5ce1a2360cb6b115877d6d4e9fc1504371) | 270801710 | stylus | - | 🟢 live | ⚠️ Stylus | 2026-05-30 critical-fix redeploy. LIVE 2026-06-01: the 6 timelock ops executed a… |
| vigil | [`0x5ccd3422…`](https://sepolia.arbiscan.io/address/0x5ccd3422f430f6d034ff46715b41509de9d0deed) | [`0xd573e52e…`](https://sepolia.arbiscan.io/tx/0xd573e52e14a6c88d435c7d574a88e51e0f0531b7fb17b670bfa2ab8cb8e6583e) | 270802353 | stylus | - | 🟢 live | ⚠️ Stylus | 2026-05-30 critical-fix redeploy. LIVE 2026-06-01: the 6 timelock ops executed a… |
| plinth-math | [`0xc53dbfc0…`](https://sepolia.arbiscan.io/address/0xc53dbfc0c35291f79e7d8d876603ab35ab97ddab) | [`0x27a07432…`](https://sepolia.arbiscan.io/tx/0x27a07432f7834f3e83bd7452137572a46a10833e73a80692dd42ad31ae4e7e3b) | 270678961 | stylus | - | 🟢 live | ⚠️ Stylus | SPAN compute extracted from Plinth (Phase A.7) to fit EIP-170 24 KB cap |
| plinth-oracle | [`0x66064d18…`](https://sepolia.arbiscan.io/address/0x66064d18722f50e055d74daf51a13fd8e331f0b7) | [`0xad2928f7…`](https://sepolia.arbiscan.io/tx/0xad2928f777e608c1108032a0148025e781a759c6655d5c0e0bc9e8d06560d4ea) | 270688421 | stylus | - | 🟢 live | ⚠️ Stylus | Dual-oracle price reader extracted from Plinth (Phase A.7), Chainlink + Pyth + m… |
| plinth | [`0xd86f579e…`](https://sepolia.arbiscan.io/address/0xd86f579ec880eaab27dfa698ae056d1893ec7553) | [`0x1fe8101f…`](https://sepolia.arbiscan.io/tx/0x1fe8101fa244db42f2399ca07a63d0a873e6e921270e6940939ccf435e1a46e0) | 270803107 | stylus | - | 🟢 live | ⚠️ Stylus | 2026-05-30 critical-fix redeploy. LIVE 2026-06-01: the 6 timelock ops executed a… |

## Solidity core

| Name | Address | Tx | Block | Kind | Version | Status | Sourcify | Notes |
|------|---------|-----|-------|------|---------|--------|----------|-------|
| praetor-timelock | [`0x0dad24d7…`](https://sepolia.arbiscan.io/address/0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4) | [`0xa05cfa1c…`](https://sepolia.arbiscan.io/tx/0xa05cfa1caa5cfd7f1b743c34ea546349c6220d1a9652836a75ba5c96db89fe33) | 270408443 | - | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4?chainId=421614) |  |
| portico-registry | [`0x9a9af6e5…`](https://sepolia.arbiscan.io/address/0x9a9af6e50491cd4694699d48564bbff18f9b40bc) | [`0x8371174f…`](https://sepolia.arbiscan.io/tx/0x8371174f4e92d47692deb4aaef335bc3543c0ad0623c185bd457173c44934505) | 270408449 | - | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x9a9af6e50491cd4694699d48564bbff18f9b40bc?chainId=421614) |  |
| curator | [`0x21c5ecc5…`](https://sepolia.arbiscan.io/address/0x21c5ecc5b3ad6b066ef32145a06ed1b688d3103d) | [`0xb0386fce…`](https://sepolia.arbiscan.io/tx/0xb0386fceceaaa2db9022913d7a4b169f1bb5018fa27940cd5037374097c5a4b5) | 270408461 | - | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x21c5ecc5b3ad6b066ef32145a06ed1b688d3103d?chainId=421614) |  |
| edict | [`0x66577042…`](https://sepolia.arbiscan.io/address/0x66577042b4d47312e554bbfa5e29ae20f55dd631) | [`0xf208cc99…`](https://sepolia.arbiscan.io/tx/0xf208cc99c46de4b7a26c1d3efc1f006ccf809c06a93374b6195f77495e7af140) | 270408469 | - | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x66577042b4d47312e554bbfa5e29ae20f55dd631?chainId=421614) |  |
| research-attestation | [`0xfabc1fee…`](https://sepolia.arbiscan.io/address/0xfabc1fee1342be58996fec74cfc3612d4ac8a0ba) | [`0xc5aa317c…`](https://sepolia.arbiscan.io/tx/0xc5aa317ca635282de65dca0a116100cdcbd3535df74279b3bf9efdb66713705c) | 270408474 | - | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0xfabc1fee1342be58996fec74cfc3612d4ac8a0ba?chainId=421614) |  |
| stoa | [`0x6d655803…`](https://sepolia.arbiscan.io/address/0x6d655803bac4bf61ad5ad26fd3b88429671cb5db) | [`0x4b74f245…`](https://sepolia.arbiscan.io/tx/0x4b74f2454e4fbaf5319f45360979d28d95f8d675d4a29e9bcf32b0ed99270b42) | 270408479 | - | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x6d655803bac4bf61ad5ad26fd3b88429671cb5db?chainId=421614) |  |
| atrium-router | [`0xF593e012…`](https://sepolia.arbiscan.io/address/0xF593e012196BDe8A58Ccdbf685f7A74fD3bD35e0) | [`0x3e96234b…`](https://sepolia.arbiscan.io/tx/0x3e96234b389258515dda252306cb046c8aa1c9c9de7812b5854645af749a85ac) | 270726101 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0xF593e012196BDe8A58Ccdbf685f7A74fD3bD35e0?chainId=421614) | 2026-05-30 critical-fix redeploy. LIVE 2026-06-01: the 6 timelock ops executed a… |
| rostrum | [`0x748A0a4E…`](https://sepolia.arbiscan.io/address/0x748A0a4E53F3E94f9a279bfDC5eCbF8A7c88f093) | [`0x1eb99f9f…`](https://sepolia.arbiscan.io/tx/0x1eb99f9f0b3b31f21057eed99eadfff03216e305c8bd154cad28f37d3886d727) | 270726103 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x748A0a4E53F3E94f9a279bfDC5eCbF8A7c88f093?chainId=421614) | Redeployed 2026-06-01 post-cutover: constructor plinth = live Plinth 0xd86f579e … |
| atrium-router-v2-current-source | [`0x09BE855e…`](https://sepolia.arbiscan.io/address/0x09BE855e5CA0fB3c11c4D0d2708660Dcc963a004) | [`0xcd6b93bc…`](https://sepolia.arbiscan.io/tx/0xcd6b93bcd6c64f7cc7012f0b3f4f6f72efd9ba739b72a186ec403730293ac379) | - | solidity | - | 🟡 pending | [✓](https://sourcify.dev/#/lookup/0x09BE855e5CA0fB3c11c4D0d2708660Dcc963a004?chainId=421614) | 2026-06-02 redeploy from current audited source (5-arg, V11-routing, timelock-ga… |

## Portico adapters

| Name | Address | Tx | Block | Kind | Version | Status | Sourcify | Notes |
|------|---------|-----|-------|------|---------|--------|----------|-------|
| adapter-aave-horizon | [`0xd71C5D88…`](https://sepolia.arbiscan.io/address/0xd71C5D88d62e92EE8941cAE51f8637a73111C4E1) | [`0x08d4d069…`](https://sepolia.arbiscan.io/tx/0x08d4d069c1370449aff4a5c8281f2e6eaa97811161f9f60917161e52ac79e48a) | - | solidity | v1.1.1 | 🟢 live | [✓](https://sourcify.dev/#/lookup/0xd71C5D88d62e92EE8941cAE51f8637a73111C4E1?chainId=421614) | 2026-05-30 critical-fix redeploy. LIVE 2026-06-01: the 6 timelock ops executed a… |
| adapter-aave-horizon-v1.1-pool-placeholder | [`0xa68361cC…`](https://sepolia.arbiscan.io/address/0xa68361cCBd819F4A38a31501D399888F9187d0b9) | [`0xe15ce592…`](https://sepolia.arbiscan.io/tx/0xe15ce5928dc27fc6e4906c86125548d6db094344d7492b18db447790b4b71583) | - | solidity | v1.1 | 🟢 live | [✓](https://sourcify.dev/#/lookup/0xa68361cCBd819F4A38a31501D399888F9187d0b9?chainId=421614) | v1.1 with deployer-EOA pool placeholder. Superseded by the MockAavePool-backed v… |
| adapter-aave-horizon-v1.0-deprecated | [`0xe991ec98…`](https://sepolia.arbiscan.io/address/0xe991ec988a62bcc38740f8b8c549e5400ded8d5d) | [`0xdff77222…`](https://sepolia.arbiscan.io/tx/0xdff7722214573f3a27dc832875b6d30b456df0e88173944feb9edc086f64c8e8) | 270727659 | solidity | - | 🔴 deprecated | [✓](https://sourcify.dev/#/lookup/0xe991ec988a62bcc38740f8b8c549e5400ded8d5d?chainId=421614) | DEPRECATED v1.0 (uses tx.origin, no ReentrancyGuard). Kept for reference; was ne… |
| adapter-curve | [`0xf3da25f3…`](https://sepolia.arbiscan.io/address/0xf3da25f3ff8bdddc093e34c2f2b117cdb7505682) | [`0x2d6d5a2a…`](https://sepolia.arbiscan.io/tx/0x2d6d5a2ad389fa5ec11b6793fb8144fbde6039773f9fd7c32e3f5c5d98acf5e7) | 270727666 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0xf3da25f3ff8bdddc093e34c2f2b117cdb7505682?chainId=421614) |  |
| adapter-gmx | [`0x2531af9f…`](https://sepolia.arbiscan.io/address/0x2531af9f7596d74f412bfab7d3b84ee7a32cd2d4) | [`0x7a47f5d8…`](https://sepolia.arbiscan.io/tx/0x7a47f5d89f54d80f06131f7140522c83361bfb2af7a3b46cd2c1f053f95b24c9) | 270727672 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x2531af9f7596d74f412bfab7d3b84ee7a32cd2d4?chainId=421614) |  |
| adapter-hyperliquid | [`0x87014fba…`](https://sepolia.arbiscan.io/address/0x87014fbace9ade49bf923bcfae74b4c858cf371e) | [`0xab0a7b44…`](https://sepolia.arbiscan.io/tx/0xab0a7b44445194087a9c019793bbfaa42372aa5110c6e660bd93d6b33b98fda0) | 270727679 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x87014fbace9ade49bf923bcfae74b4c858cf371e?chainId=421614) | Shared by HIP-3 + HIP-4. Bridge placeholder = deployer. |
| adapter-morpho | [`0xfabe2b0d…`](https://sepolia.arbiscan.io/address/0xfabe2b0d1c66bc2976ed3b0c58f3cdcb7878344e) | [`0x139d0cc7…`](https://sepolia.arbiscan.io/tx/0x139d0cc7e9bb47101eea1a341ca70152f8f4986deef3f0cd307e5a47147a9cd0) | 270727682 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0xfabe2b0d1c66bc2976ed3b0c58f3cdcb7878344e?chainId=421614) |  |
| adapter-pendle | [`0x54a1bc2c…`](https://sepolia.arbiscan.io/address/0x54a1bc2c5c73cc531035b0f008c8a252a02daf7d) | [`0xfb7ccf36…`](https://sepolia.arbiscan.io/tx/0xfb7ccf368fc5e9f802e27cab10dd4c7cd2bad3792bda0b35f97346aef1eb6b5f) | 270727686 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x54a1bc2c5c73cc531035b0f008c8a252a02daf7d?chainId=421614) |  |
| adapter-polymarket | [`0x98a68872…`](https://sepolia.arbiscan.io/address/0x98a688723c47ab6909be04fd0aa3eca5ee8b08db) | [`0x5e5686ac…`](https://sepolia.arbiscan.io/tx/0x5e5686ac5371703f09625a691ddf876204f5ad2e5d30234a943439f1b981d6c0) | 270727693 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x98a688723c47ab6909be04fd0aa3eca5ee8b08db?chainId=421614) | Routes via Aqueduct to Polygon Amoy testnet (CCIP selector 16281711391670634445) |
| adapter-synthetix | [`0x62b3b34f…`](https://sepolia.arbiscan.io/address/0x62b3b34ffa76fb62245702c0b7efd37832eb39b8) | [`0x3e72aa7e…`](https://sepolia.arbiscan.io/tx/0x3e72aa7ee5ef0da71b516022edcfddef178536d12d2aa6e6983bdb30bbd10632) | 270727698 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x62b3b34ffa76fb62245702c0b7efd37832eb39b8?chainId=421614) |  |
| adapter-trade-xyz | [`0xf34c38d9…`](https://sepolia.arbiscan.io/address/0xf34c38d9e61a1b1beafffbb681b07e489c36a1ce) | [`0xac4298a2…`](https://sepolia.arbiscan.io/tx/0xac4298a2ab96e2c88d22b3677153835558323208019539145381345b672b1a64) | 270727704 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0xf34c38d9e61a1b1beafffbb681b07e489c36a1ce?chainId=421614) |  |

## Aqueduct family

| Name | Address | Tx | Block | Kind | Version | Status | Sourcify | Notes |
|------|---------|-----|-------|------|---------|--------|----------|-------|
| aqueduct | [`0x6139449b…`](https://sepolia.arbiscan.io/address/0x6139449bf43f44385d08640b2e6fd2b82cb87ec2) | [`0x057918f2…`](https://sepolia.arbiscan.io/tx/0x057918f272f61d6992350b8b7da9f6ad2ef0bcaa30947c829a4e8672af69f9a1) | 270683155 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x6139449bf43f44385d08640b2e6fd2b82cb87ec2?chainId=421614) |  |
| aqueduct-receiver | [`0x49Bd2AF2…`](https://sepolia.arbiscan.io/address/0x49Bd2AF2d2ee1844235bb6500Ba4EC6F24704b42) | [`0x19610811…`](https://sepolia.arbiscan.io/tx/0x196108115a52f667d03232d3e8a691e62754cd5c7014f885d07159ddb3e1fd28) | 270683161 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x49Bd2AF2d2ee1844235bb6500Ba4EC6F24704b42?chainId=421614) | 2026-05-30 critical-fix redeploy. LIVE 2026-06-01: the 6 timelock ops executed a… |
| aqueduct-claimback | [`0x4d441fca…`](https://sepolia.arbiscan.io/address/0x4d441fca986d51d17c71f979814e2a492a429382) | [`0x5776f1bd…`](https://sepolia.arbiscan.io/tx/0x5776f1bd0e66c366f5b95cdaa214fe4cb3f3f5d3f37ff79e369380d494d60787) | 270683165 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x4d441fca986d51d17c71f979814e2a492a429382?chainId=421614) |  |

## Postern family

| Name | Address | Tx | Block | Kind | Version | Status | Sourcify | Notes |
|------|---------|-----|-------|------|---------|--------|----------|-------|
| postern-key-registry | [`0x28c9fd50…`](https://sepolia.arbiscan.io/address/0x28c9fd500d2d8e3b56259a1054e9da05dec747d8) | [`0xacf2cbc0…`](https://sepolia.arbiscan.io/tx/0xacf2cbc0431449283efd496ccdd4bf235830ed1b0530a203b0af8fa61ac81ee4) | 270683171 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x28c9fd500d2d8e3b56259a1054e9da05dec747d8?chainId=421614) |  |
| postern-kill-switch | [`0xCD899f71…`](https://sepolia.arbiscan.io/address/0xCD899f715462A33Ae880310d72b37bde102ab0b7) | [`0x4a870578…`](https://sepolia.arbiscan.io/tx/0x4a8705786d1841283050dc4206b078b4c6596ef11cd57097d6ecedb7c5a9f6b1) | 270683177 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0xCD899f715462A33Ae880310d72b37bde102ab0b7?chainId=421614) | Redeployed 2026-06-01 post-cutover: constructor sigil = live Sigil 0xdba97d39, s… |

## Lantern + test infrastructure

| Name | Address | Tx | Block | Kind | Version | Status | Sourcify | Notes |
|------|---------|-----|-------|------|---------|--------|----------|-------|
| lantern-attestor | [`0xF0B90b94…`](https://sepolia.arbiscan.io/address/0xF0B90b94C0B8a52c545768bFf06a3932c67d5888) | [`0x9ddd82d3…`](https://sepolia.arbiscan.io/tx/0x9ddd82d326fae6210b04146efaca45c333e8c5d46906f784ce0956a19a0f7ef4) | 270918668 | solidity | v2 | 🟢 live | [✓](https://sourcify.dev/#/lookup/0xF0B90b94C0B8a52c545768bFf06a3932c67d5888?chainId=421614) | Redeployed 2026-05-25 (Phase zeta.1, audit TT-17 fix). AttestationPublished even… |
| lantern-attestor-v1-pre-event-extension | [`0x900a9fb4…`](https://sepolia.arbiscan.io/address/0x900a9fb4bab7576fc11e4bb3c002d89dbe261168) | [`0x2343d14a…`](https://sepolia.arbiscan.io/tx/0x2343d14a743cef74768ec818de86d9154409d13ef3c97c987a8b79d1ca56a53c) | 270408455 | - | - | 🔴 deprecated | [✓](https://sourcify.dev/#/lookup/0x900a9fb4bab7576fc11e4bb3c002d89dbe261168?chainId=421614) | DEPRECATED v1 (3-field event). Replaced by v2 above on 2026-05-25. Kept for tx h… |
| mock-aave-pool | [`0x2e1360fa…`](https://sepolia.arbiscan.io/address/0x2e1360faE80c7937e684067450202D921F72555B) | [`0x3dd459b7…`](https://sepolia.arbiscan.io/tx/0x3dd459b7fca1838e20ba85bed173d7d538bc3bb46057b29406ca55aa03ce52c9) | - | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x2e1360faE80c7937e684067450202D921F72555B?chainId=421614) | Testnet stub for Aave V3 Pool. Round-trips USDC 1:1 with a 5-bps-per-call drifti… |

## Faucet + utility

| Name | Address | Tx | Block | Kind | Version | Status | Sourcify | Notes |
|------|---------|-----|-------|------|---------|--------|----------|-------|
| faucet | [`0x7f3a714c…`](https://sepolia.arbiscan.io/address/0x7f3a714c824c0926ae98ecfb2e59513e78d82bbc) | [`0x269cdc4c…`](https://sepolia.arbiscan.io/tx/0x269cdc4cb11280422c9d36096f26829e07166851e2673f529923c60fa696724d) | 270742814 | solidity | - | 🟢 live | [✓](https://sourcify.dev/#/lookup/0x7f3a714c824c0926ae98ecfb2e59513e78d82bbc?chainId=421614) | 5 USDC + 0.0005 ETH per claim, 24h cooldown. Stocked with 40 USDC + 0.04 ETH (8 … |
| faucet-deprecated-v1 | [`0xb982c46d…`](https://sepolia.arbiscan.io/address/0xb982c46d7a4aa7f1ebef91ca4cc0a34be1cf8549) | [`0x0ef3e327…`](https://sepolia.arbiscan.io/tx/0x0ef3e3271b2243dcb6ad9411222ac2cdd331b05bd06bcc28d1e04bf1ae48e001) | 270691652 | solidity | - | 🔴 deprecated | [✓](https://sourcify.dev/#/lookup/0xb982c46d7a4aa7f1ebef91ca4cc0a34be1cf8549?chainId=421614) | DEPRECATED. Original 100-USDC drop was too large for the testnet refill cadence.… |

---

### Sourcify verification

Solidity contracts are verified on [Sourcify](https://sourcify.dev) (full match). Stylus WASM contracts (Plinth, Coffer, Sigil, Vigil, Plinth-Math, Plinth-Oracle) are not yet supported by Sourcify, verification is done via `cargo stylus verify` against the Arbitrum Stylus verifier.

---

Generated at 2026-06-05T11:18:50Z from `deployments/arbitrum_sepolia.json`.