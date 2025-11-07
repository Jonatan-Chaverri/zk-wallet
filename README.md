# zkWallet — Privacy-Preserving Account-Abstracted Wallet on Arbitrum Stylus

## Team
- **Team / Individual Name:** Jonatan Chaverri, Shramee Srivastav, Gerson Loaiza
- **GitHub Handle:** [@jonatan-chaverri](https://github.com/jonatan-chaverri), [@Shramme](https://github.com/shramee) [@Gerson](https://github.com/Gerson2102)
- **Devfolio Handle:** @jonatanchaverri @0xGerson

---

## Project Description
zkWallet is a **privacy-preserving smart-wallet** built with **Account Abstraction (ERC-4337)** on **Arbitrum Stylus (WASM)**.  
It enables users to deposit, transfer, and withdraw ERC-20 tokens **privately and verifiably** using zero-knowledge commitments and proofs.

**Core idea:**  
Each user operates a *smart-wallet account* that automatically routes transfers through a **shielded-pool contract**, concealing transaction amounts and sender/recipient linkages.  
All proof verification runs efficiently on Stylus (WASM / Rust) to minimize gas costs.

**Why it matters:**  
Today, every on-chain transaction — who sent it, to whom, and how much — is permanently visible to everyone.
This transparency, while useful for auditing, also exposes people’s private lives, beliefs, and affiliations.

zkWallet makes financial privacy accessible without sacrificing accountability.
It allows anyone to transact on-chain — supporting causes, organizations, or individuals — without broadcasting their identity or donation size to the world.

Example use cases:
- Activists & journalists can send and receive funds safely without exposing their networks.
- Citizens can donate to non-profits or community initiatives without their financial history being traceable forever.
- Companies can compensate contractors or suppliers confidentially.
- Ordinary users can protect salary or personal payments from public exposure, avoiding exploitation or profiling.

zkWallet bridges the gap between privacy and compliance — all transfers are private to the public but provable to auditors.
It redefines on-chain privacy as a human right, not a loophole.

---

## Tech Stack
- **Arbitrum Stylus (WASM / Rust)** — on-chain proof verification & shield-pool logic  
- **Solidity Bridge Contracts** — ERC-20 deposit / withdraw interface  
- **Account Abstraction (ERC-4337)** — smart-wallet accounts & relayer flow  
- **zk-Proofs / Pedersen Commitments / Bulletproofs** — confidential transaction layer  
- **Relayer / Bundler Service** — gas abstraction & sender-identity privacy  
- **Frontend (Next.js / TypeScript)** — wallet UI for deposit, send & withdraw  

---

## Objectives
By the end of ARG25 (Week 3), zkWallet aims to:

1. ✅ Deploy a working **Stylus shield-pool contract** with confidential deposit / withdraw.  
2. ✅ Implement **AA smart-wallet factory** for user onboarding.  
3. ✅ Integrate **relayer + permit flow** to hide gas payer.  
4. ✅ Demonstrate **cheaper on-chain proof verification** vs Solidity baseline.  
5. ✅ Deliver a **demo wallet UI** showing private transfers and withdrawals.

---

## Weekly Progress

### Week 1 (ends Oct 31)
**Goals**
- Finalize protocol architecture (AA + Stylus + shielded pool).  
- Set up local Stylus environment and scaffold contracts.  
- Define commitment, nullifier & proof data structures.
- Start implementing `deposit()` and `withdraw()` skeletons in Rust (WASM).  
- Write README & submit initial PR for Invisible Garden.

**Progress Summary**
- ✅ Completed research on Arbitrum Stylus performance & Account Abstraction flow.  
- ✅ Designed high-level privacy architecture (wallet ↔ relayer ↔ pool ↔ auditor).  
- ✅ Outlined audit-compliant data model for encrypted note openings.  
- 🚧 Began coding Stylus contract boilerplate and integration tests.  
- 📎 Next step: integrate Bulletproof verifier in Rust and test fixed-denomination deposits.

---

### Week 2 (ends Nov 7)
**Goals**
- Implement commitment + nullifier logic inside Stylus contract.  
- Integrate ERC-20 bridge & relayer service.  
- Prototype smart-wallet factory (ERC-4337 compatible).  
- Launch local testnet demo with private deposit → withdraw flow.

**Progress Summary**
_(to be filled next week)_

---

### 🗓️ Week 3 (ends Nov 14)
**Goals**
- Optimize proof-verification gas usage.  
- Add encrypted audit API & sample compliance report.  
- Polish wallet UI and prepare final demo video.  
- Submit final deliverables + presentation.

**Progress Summary**
_(to be filled Week 3)_

---

## Final Wrap-Up (to fill after Week 3)
- **Main Repository Link:** 
- **Demo / Deployment Link:** 
- **Slides / Presentation:**

---

## 🧾 Learnings (to update end of program)
Expected topics: Stylus WASM optimizations, AA relayer design, confidential-transaction proof performance, regulatory trade-offs.

---

## Next Steps (after ARG25)
- Deploy to Arbitrum mainnet after Stylus audits.  
- Integrate additional privacy features (stealth addresses, batch withdrawals).  
- Open-source core Stylus contracts under MIT license.

---

_This template is part of the [ARG25 Projects Repository](https://github.com/invisible-garden/arg25-projects)._  
_Update this file weekly by committing and pushing to your fork, keeping a single PR open through the 3 weeks._
