import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import ABI from "../lib/abi";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

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

  const statusColorClass = roundStatus === "OPEN" ? "text-gold"
    : roundStatus === "PAUSED" ? "text-orange"
    : roundStatus === "DRAW IN PROGRESS" ? "text-orange"
    : "text-muted";

  return (
    <div className="bg-dark min-h-screen text-snow">

      {/* header */}
      <header className="bg-mid border-b-2 border-gold px-8 flex justify-between items-center h-16">
        <div className="flex items-center gap-3">
          <span className="text-[28px] animate-spin3d">🪙</span>
          <span className="text-[22px] font-black text-gold tracking-[3px]">LOTTO</span>
          <span className="text-[11px] text-muted tracking-[2px] mt-0.5">POWERED BY CHAINLINK</span>
        </div>
        {account ? (
          <div className="flex gap-2.5 items-center">
            <span className="bg-lght border border-rim px-3.5 py-1.5 text-xs rounded-sm text-gold-light">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
            <button onClick={disconnect} className="outline-btn">Disconnect</button>
          </div>
        ) : (
          <button onClick={connect} className="gold-btn">Connect Wallet</button>
        )}
      </header>

      {/* ticker bar */}
      <div className="bg-gold py-1.5 px-8 text-[11px] text-dark font-bold tracking-[2px] overflow-hidden">
        <div className="animate-ticker">
          🪙 PICK 7 NUMBERS FROM 1–49 &nbsp;·&nbsp; MATCH FROM LEFT TO WIN &nbsp;·&nbsp; POWERED BY CHAINLINK VRF &nbsp;·&nbsp; FULLY AUTOMATED &nbsp;·&nbsp; 🪙 PICK 7 NUMBERS FROM 1–49 &nbsp;·&nbsp; MATCH FROM LEFT TO WIN &nbsp;·&nbsp; POWERED BY CHAINLINK VRF &nbsp;·&nbsp; FULLY AUTOMATED &nbsp;·&nbsp;
        </div>
      </div>

      <div className="max-w-[860px] mx-auto px-4 py-7">

        {!account ? (
          <div className="text-center mt-20">
            <div className="text-[64px] mb-4">🎰</div>
            <div className="text-[28px] font-black text-gold tracking-[3px] mb-2">LOTTO</div>
            <p className="text-muted mb-8 text-sm">Connect your wallet to enter the draw</p>
            <button onClick={connect} className="gold-btn px-12 py-3.5 text-base">Connect Wallet</button>
          </div>
        ) : (
          <>
            {/* round stats */}
            <div className="grid grid-cols-4 gap-0.5 mb-6">
              <StatBox label="ROUND" value={`#${roundId ?? "—"}`} />
              <StatBox label="STATUS" value={roundStatus} valueClass={statusColorClass} />
              <StatBox label="POT" value={`${pot} ETH`} valueClass="text-gold-light" />
              <StatBox label="TIME LEFT" value={paused ? "—" : timeLeft ?? "—"} valueClass={roundStatus === "OPEN" ? "text-snow" : "text-muted"} />
            </div>
            <div className="grid grid-cols-2 gap-0.5 mb-6">
              <StatBox label="TICKETS SOLD" value={ticketCount} />
              <StatBox label="ENTRY FEE" value={entryFee ? `${ethers.formatEther(entryFee)} ETH` : "—"} valueClass="text-gold-light" />
            </div>

            {/* last winning numbers */}
            {lastWinningNumbers && (
              <div className="bg-mid border border-rim px-5 py-4 mb-6">
                <div className="text-[10px] tracking-[3px] text-gold mb-3">LAST DRAW RESULTS</div>
                <div className="flex gap-2 flex-wrap">
                  {lastWinningNumbers.map((n, i) => (
                    <div key={i} className="w-10 h-10 rounded-full bg-gold text-dark flex items-center justify-center font-black text-sm">
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* pending reward */}
            {parseFloat(pendingReward) > 0 && (
              <div className="bg-win-bg border-2 border-gold px-5 py-4 mb-6 flex justify-between items-center">
                <div>
                  <div className="text-[10px] tracking-[2px] text-gold mb-1">🏆 YOU HAVE WINNINGS</div>
                  <div className="text-[22px] font-black text-gold-light">{pendingReward} ETH</div>
                </div>
                <button onClick={withdraw} disabled={loading} className="gold-btn">Withdraw</button>
              </div>
            )}

            {/* ticket entry */}
            {paused ? (
              <div className="bg-mid border-2 border-orange px-6 py-6 text-center mb-6">
                <div className="text-base font-bold text-orange tracking-[2px]">⏸ GAME PAUSED</div>
                <div className="text-xs text-muted mt-2">The game is temporarily paused. Check back soon.</div>
              </div>
            ) : hasEntered ? (
              <div className="bg-mid border border-rim px-6 py-6 text-center mb-6">
                <div className="text-base font-bold text-gold tracking-[2px]">✅ TICKET SUBMITTED</div>
                <div className="text-xs text-muted mt-2">Your entry is in. Check back after the draw for results.</div>
              </div>
            ) : round?.active && !round?.drawRequested ? (
              <div className="bg-mid border border-rim px-6 py-6 mb-6">
                <div className="text-[11px] tracking-[3px] text-gold mb-5">
                  SELECT YOUR 7 LUCKY NUMBERS &nbsp;
                  <span className={selected.length === 7 ? "text-gold-light" : "text-muted"}>({selected.length}/7)</span>
                </div>

                {/* number grid */}
                <div className="grid grid-cols-7 gap-1.5 mb-5">
                  {Array.from({ length: 49 }, (_, i) => i + 1).map((n) => {
                    const on = selected.includes(n);
                    return (
                      <button
                        key={n}
                        onClick={() => toggleNumber(n)}
                        className={`py-2.5 border text-[13px] rounded-sm transition-all duration-100 cursor-pointer
                          ${on
                            ? "border-gold bg-gold text-dark font-black"
                            : "border-rim bg-transparent text-snow font-normal hover:border-gold"
                          }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>

                {/* selected display */}
                <div className="flex gap-2 mb-5 min-h-11 items-center flex-wrap">
                  {selected.length === 0 ? (
                    <span className="text-xs text-muted">No numbers selected yet</span>
                  ) : (
                    [...selected].sort((a, b) => a - b).map((n) => (
                      <div key={n} className="w-10 h-10 rounded-full bg-gold text-dark flex items-center justify-center font-black text-sm">
                        {n}
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={buyTicket}
                    disabled={loading || selected.length !== 7}
                    className={`gold-btn px-8 py-3 text-sm ${selected.length !== 7 ? "opacity-40" : ""}`}
                  >
                    {loading ? "Processing..." : `ENTER DRAW — ${entryFee ? ethers.formatEther(entryFee) : "?"} ETH`}
                  </button>
                  {selected.length > 0 && (
                    <button onClick={() => setSelected([])} className="outline-btn">Clear</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-mid border border-rim px-6 py-6 text-center mb-6">
                <div className="text-sm font-bold text-muted tracking-[2px]">
                  {round?.drawRequested ? "⏳ DRAW IN PROGRESS — AWAITING CHAINLINK VRF" : "⏳ WAITING FOR NEXT ROUND"}
                </div>
              </div>
            )}

            {/* status message */}
            {status && (
              <div className={`border px-4 py-3 text-[13px] mb-6
                ${statusType === "success" ? "bg-success-bg border-gold text-snow"
                  : statusType === "error" ? "bg-error-bg border-[#c0392b] text-error"
                  : "bg-mid border-rim text-snow"}`}
              >
                {status}
              </div>
            )}

            {/* reward tiers */}
            <div className="bg-mid border border-rim p-5">
              <div className="text-[10px] tracking-[3px] text-gold mb-4">PRIZE TIERS</div>
              <div className="grid grid-cols-6 gap-1.5 text-center mb-3">
                {[["2", "5%"], ["3", "10%"], ["4", "15%"], ["5", "20%"], ["6", "20%"], ["7", "30%"]].map(([m, r]) => (
                  <div key={m} className="bg-lght border border-rim py-2.5 px-1">
                    <div className="font-black text-[18px] text-gold-light">{m}</div>
                    <div className="text-[10px] text-muted tracking-[1px]">MATCH</div>
                    <div className="text-[13px] text-gold font-bold mt-1">{r}</div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-muted leading-relaxed">
                10% owner fee deducted from pot · Numbers must match from left · Unmatched tiers roll over to next round
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, valueClass = "text-snow" }) {
  return (
    <div className="bg-mid border border-rim px-4 py-3.5">
      <div className="text-[9px] tracking-[3px] text-muted mb-1.5">{label}</div>
      <div className={`font-black text-base ${valueClass}`}>{value}</div>
    </div>
  );
}
