import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import ABI from "../lib/abi";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

const G = {
  dark: "#1a0a2e",
  mid: "#2a1a4a",
  light: "#3d2a6b",
  gold: "#c9a84c",
  goldLight: "#e8c96a",
  white: "#f5f5f0",
  grey: "#9a8aaa",
  border: "#4a3a6b",
};

export default function Home() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);

  const [round, setRound] = useState(null);
  const [roundId, setRoundId] = useState(null);
  const [entryFee, setEntryFee] = useState(null);
  const [ticketCount, setTicketCount] = useState(0);
  const [pot, setPot] = useState("0");
  const [timeLeft, setTimeLeft] = useState(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [pendingReward, setPendingReward] = useState("0");
  const [lastWinningNumbers, setLastWinningNumbers] = useState(null);
  const [paused, setPaused] = useState(false);

  const [selected, setSelected] = useState([]);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("info");
  const [loading, setLoading] = useState(false);

  const setMsg = (msg, type = "info") => { setStatus(msg); setStatusType(type); };

  const disconnect = () => {
    setAccount(null); setContract(null); setRound(null); setRoundId(null);
    setEntryFee(null); setTicketCount(0); setPot("0"); setTimeLeft(null);
    setHasEntered(false); setPendingReward("0"); setLastWinningNumbers(null);
    setPaused(false); setSelected([]); setStatus("");
  };

  const connect = async () => {
    if (!window.ethereum) return setMsg("MetaMask not found.", "error");
    const p = new ethers.BrowserProvider(window.ethereum);
    await p.send("eth_requestAccounts", []);
    const signer = await p.getSigner();
    const addr = await signer.getAddress();
    const c = new ethers.Contract(CONTRACT, ABI, signer);
    setAccount(addr);
    setContract(c);
  };

  const load = useCallback(async () => {
    if (!contract || !account) return;
    try {
      const id = await contract.currentRoundId();
      const r = await contract.rounds(id);
      const fee = await contract.entryFee();
      const count = await contract.getRoundTicketCount(id);
      const entered = await contract.hasEntered(id, account);
      const reward = await contract.pendingRewards(account);
      const isPaused = await contract.paused();
      setRoundId(id.toString());
      setRound(r);
      setEntryFee(fee);
      setTicketCount(count.toString());
      setPot(ethers.formatEther(r.pot));
      setHasEntered(entered);
      setPendingReward(ethers.formatEther(reward));
      setPaused(isPaused);
      if (id > 1n) {
        const prev = await contract.getRoundWinningNumbers(id - 1n);
        setLastWinningNumbers(prev.map((n) => n.toString()));
      }
    } catch (e) { console.error(e); }
  }, [contract, account]);

  useEffect(() => {
    if (!round) return;
    const calc = () => {
      const diff = Number(round.endTime.toString()) * 1000 - Date.now();
      if (diff <= 0) return setTimeLeft("Draw pending...");
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [round]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const toggleNumber = (n) => {
    if (selected.includes(n)) setSelected(selected.filter((x) => x !== n));
    else if (selected.length < 7) setSelected([...selected, n]);
  };

  const buyTicket = async () => {
    if (selected.length !== 7) return setMsg("Select exactly 7 numbers.", "error");
    try {
      setLoading(true);
      setMsg("Confirm transaction in MetaMask...", "info");
      const sorted = [...selected].sort((a, b) => a - b);
      const tx = await contract.buyTicket(sorted, { value: entryFee });
      setMsg("Transaction submitted, waiting for confirmation...", "info");
      await tx.wait();
      setMsg("Ticket purchased successfully! Good luck! 🍀", "success");
      setSelected([]);
      load();
    } catch (e) {
      setMsg(e.reason || e.message || "Transaction failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const withdraw = async () => {
    try {
      setLoading(true);
      setMsg("Withdrawing winnings...", "info");
      const tx = await contract.withdrawReward();
      await tx.wait();
      setMsg("Winnings withdrawn successfully! 🏆", "success");
      load();
    } catch (e) {
      setMsg(e.reason || e.message || "Withdraw failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const roundStatus = paused ? "PAUSED"
    : round
    ? round.drawRequested ? "DRAW IN PROGRESS"
    : round.active ? "OPEN"
    : "CLOSED"
    : "—";

  const statusColor = roundStatus === "OPEN" ? G.gold
    : roundStatus === "PAUSED" ? "#e67e22"
    : roundStatus === "DRAW IN PROGRESS" ? "#e67e22"
    : G.grey;

  return (
    <div style={{ background: G.dark, minHeight: "100vh", color: G.white }}>

      {/* header */}
      <div style={{ background: G.mid, borderBottom: `2px solid ${G.gold}`, padding: "0 32px", display: "flex", justifyContent: "space-between", alignItems: "center", height: "64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            fontSize: "28px",
            animation: "spin3d 2s linear infinite",
            display: "inline-block",
          }}>🪙</div>
          <span style={{ fontSize: "22px", fontWeight: "900", color: G.gold, letterSpacing: "3px" }}>LOTTO</span>
          <span style={{ fontSize: "11px", color: G.grey, letterSpacing: "2px", marginTop: "2px" }}>POWERED BY CHAINLINK</span>
          <style>{`
            @keyframes spin3d {
              0%   { transform: rotateY(0deg); }
              100% { transform: rotateY(360deg); }
            }
          `}</style>
        </div>
        {account ? (
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ background: G.light, border: `1px solid ${G.border}`, padding: "6px 14px", fontSize: "12px", borderRadius: "2px", color: G.goldLight }}>
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
            <button onClick={disconnect} style={outlineBtn}>Disconnect</button>
          </div>
        ) : (
          <button onClick={connect} style={goldBtn}>Connect Wallet</button>
        )}
      </div>

      {/* ticker bar */}
      <div style={{ background: G.gold, padding: "6px 32px", fontSize: "11px", color: G.dark, fontWeight: "bold", letterSpacing: "2px", overflow: "hidden", position: "relative" }}>
        <div style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          animation: "ticker 18s linear infinite",
        }}>
          🪙 PICK 7 NUMBERS FROM 1–49 &nbsp;·&nbsp; MATCH FROM LEFT TO WIN &nbsp;·&nbsp; POWERED BY CHAINLINK VRF &nbsp;·&nbsp; FULLY AUTOMATED &nbsp;·&nbsp; 🪙 PICK 7 NUMBERS FROM 1–49 &nbsp;·&nbsp; MATCH FROM LEFT TO WIN &nbsp;·&nbsp; POWERED BY CHAINLINK VRF &nbsp;·&nbsp; FULLY AUTOMATED &nbsp;·&nbsp;
        </div>
        <style>{`
          @keyframes ticker {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "28px 16px" }}>

        {!account ? (
          <div style={{ textAlign: "center", marginTop: "80px" }}>
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>🎰</div>
            <div style={{ fontSize: "28px", fontWeight: "900", color: G.gold, letterSpacing: "3px", marginBottom: "8px" }}>LOTTO</div>
            <p style={{ color: G.grey, marginBottom: "32px", fontSize: "14px" }}>Connect your wallet to enter the draw</p>
            <button onClick={connect} style={{ ...goldBtn, padding: "14px 48px", fontSize: "16px" }}>Connect Wallet</button>
          </div>
        ) : (
          <>
            {/* round stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2px", marginBottom: "24px" }}>
              <StatBox label="ROUND" value={`#${roundId ?? "—"}`} />
              <StatBox label="STATUS" value={roundStatus} valueColor={statusColor} />
              <StatBox label="POT" value={`${pot} ETH`} valueColor={G.goldLight} />
              <StatBox label="TIME LEFT" value={paused ? "—" : timeLeft ?? "—"} valueColor={roundStatus === "OPEN" ? G.white : G.grey} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px", marginBottom: "24px" }}>
              <StatBox label="TICKETS SOLD" value={ticketCount} />
              <StatBox label="ENTRY FEE" value={entryFee ? `${ethers.formatEther(entryFee)} ETH` : "—"} valueColor={G.goldLight} />
            </div>

            {/* last winning numbers */}
            {lastWinningNumbers && (
              <div style={{ background: G.mid, border: `1px solid ${G.border}`, padding: "16px 20px", marginBottom: "24px" }}>
                <div style={{ fontSize: "10px", letterSpacing: "3px", color: G.gold, marginBottom: "12px" }}>LAST DRAW RESULTS</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {lastWinningNumbers.map((n, i) => (
                    <div key={i} style={{ width: "40px", height: "40px", borderRadius: "50%", background: G.gold, color: G.dark, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "14px" }}>
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* pending reward */}
            {parseFloat(pendingReward) > 0 && (
              <div style={{ background: "#2a0a4a", border: `2px solid ${G.gold}`, padding: "16px 20px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "10px", letterSpacing: "2px", color: G.gold, marginBottom: "4px" }}>🏆 YOU HAVE WINNINGS</div>
                  <div style={{ fontSize: "22px", fontWeight: "900", color: G.goldLight }}>{pendingReward} ETH</div>
                </div>
                <button onClick={withdraw} disabled={loading} style={goldBtn}>Withdraw</button>
              </div>
            )}

            {/* ticket entry */}
            {paused ? (
              <div style={{ background: G.mid, border: `2px solid #e67e22`, padding: "24px", textAlign: "center", marginBottom: "24px" }}>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#e67e22", letterSpacing: "2px" }}>⏸ GAME PAUSED</div>
                <div style={{ fontSize: "12px", color: G.grey, marginTop: "8px" }}>The game is temporarily paused. Check back soon.</div>
              </div>
            ) : hasEntered ? (
              <div style={{ background: G.mid, border: `1px solid ${G.border}`, padding: "24px", textAlign: "center", marginBottom: "24px" }}>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: G.gold, letterSpacing: "2px" }}>✅ TICKET SUBMITTED</div>
                <div style={{ fontSize: "12px", color: G.grey, marginTop: "8px" }}>Your entry is in. Check back after the draw for results.</div>
              </div>
            ) : round?.active && !round?.drawRequested ? (
              <div style={{ background: G.mid, border: `1px solid ${G.border}`, padding: "24px", marginBottom: "24px" }}>
                <div style={{ fontSize: "11px", letterSpacing: "3px", color: G.gold, marginBottom: "20px" }}>
                  SELECT YOUR 7 LUCKY NUMBERS &nbsp;
                  <span style={{ color: selected.length === 7 ? G.goldLight : G.grey }}>({selected.length}/7)</span>
                </div>

                {/* number grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", marginBottom: "20px" }}>
                  {Array.from({ length: 49 }, (_, i) => i + 1).map((n) => {
                    const on = selected.includes(n);
                    return (
                      <button key={n} onClick={() => toggleNumber(n)} style={{
                        padding: "10px 0",
                        border: `1px solid ${on ? G.gold : G.border}`,
                        background: on ? G.gold : "transparent",
                        color: on ? G.dark : G.white,
                        cursor: "pointer",
                        fontWeight: on ? "900" : "normal",
                        fontSize: "13px",
                        borderRadius: "2px",
                        transition: "all 0.1s",
                      }}>
                        {n}
                      </button>
                    );
                  })}
                </div>

                {/* selected display */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "20px", minHeight: "44px", alignItems: "center", flexWrap: "wrap" }}>
                  {selected.length === 0 ? (
                    <span style={{ fontSize: "12px", color: G.grey }}>No numbers selected yet</span>
                  ) : (
                    [...selected].sort((a, b) => a - b).map((n) => (
                      <div key={n} style={{ width: "40px", height: "40px", borderRadius: "50%", background: G.gold, color: G.dark, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "14px" }}>
                        {n}
                      </div>
                    ))
                  )}
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button onClick={buyTicket} disabled={loading || selected.length !== 7} style={{ ...goldBtn, padding: "12px 32px", fontSize: "14px", opacity: selected.length !== 7 ? 0.4 : 1 }}>
                    {loading ? "Processing..." : `ENTER DRAW — ${entryFee ? ethers.formatEther(entryFee) : "?"} ETH`}
                  </button>
                  {selected.length > 0 && (
                    <button onClick={() => setSelected([])} style={outlineBtn}>Clear</button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ background: G.mid, border: `1px solid ${G.border}`, padding: "24px", textAlign: "center", marginBottom: "24px" }}>
                <div style={{ fontSize: "14px", fontWeight: "bold", color: G.grey, letterSpacing: "2px" }}>
                  {round?.drawRequested ? "⏳ DRAW IN PROGRESS — AWAITING CHAINLINK VRF" : "⏳ WAITING FOR NEXT ROUND"}
                </div>
              </div>
            )}

            {/* status message */}
            {status && (
              <div style={{ background: statusType === "success" ? "#1a4a0a" : statusType === "error" ? "#4a0a0a" : G.mid, border: `1px solid ${statusType === "success" ? G.gold : statusType === "error" ? "#c0392b" : G.border}`, padding: "12px 16px", fontSize: "13px", marginBottom: "24px", color: statusType === "error" ? "#e74c3c" : G.white }}>
                {status}
              </div>
            )}

            {/* reward tiers */}
            <div style={{ background: G.mid, border: `1px solid ${G.border}`, padding: "20px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: G.gold, marginBottom: "16px" }}>PRIZE TIERS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "6px", textAlign: "center", marginBottom: "12px" }}>
                {[["2", "5%"], ["3", "10%"], ["4", "15%"], ["5", "20%"], ["6", "20%"], ["7", "30%"]].map(([m, r]) => (
                  <div key={m} style={{ background: G.light, border: `1px solid ${G.border}`, padding: "10px 4px" }}>
                    <div style={{ fontWeight: "900", fontSize: "18px", color: G.goldLight }}>{m}</div>
                    <div style={{ fontSize: "10px", color: G.grey, letterSpacing: "1px" }}>MATCH</div>
                    <div style={{ fontSize: "13px", color: G.gold, fontWeight: "bold", marginTop: "4px" }}>{r}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "11px", color: G.grey, lineHeight: "1.6" }}>
                10% owner fee deducted from pot · Numbers must match from left · Unmatched tiers roll over to next round
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, valueColor }) {
  return (
    <div style={{ background: G.mid, border: `1px solid ${G.border}`, padding: "14px 18px" }}>
      <div style={{ fontSize: "9px", letterSpacing: "3px", color: G.grey, marginBottom: "6px" }}>{label}</div>
      <div style={{ fontWeight: "900", fontSize: "16px", color: valueColor || G.white }}>{value}</div>
    </div>
  );
}

const goldBtn = {
  background: G.gold,
  color: G.dark,
  border: `2px solid ${G.gold}`,
  padding: "8px 18px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
  letterSpacing: "1px",
  borderRadius: "2px",
};

const outlineBtn = {
  background: "transparent",
  color: G.gold,
  border: `2px solid ${G.gold}`,
  padding: "8px 18px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
  letterSpacing: "1px",
  borderRadius: "2px",
};
