// players.js — routes for player-specific data

const express = require("express");
const db = require("../../db");

const router = express.Router();

/**
 * @swagger
 * /players/{address}/tickets:
 *   get:
 *     summary: Get all tickets for a player
 *     description: Returns every ticket a wallet address has ever bought, with round results included.
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Player wallet address (0x...)
 *     responses:
 *       200:
 *         description: List of tickets with round info
 */
router.get("/:address/tickets", async (req, res) => {
  const address = req.params.address.toLowerCase();
  try {
    const result = await db.query(
      `SELECT t.*, r.winning_numbers, r.drawn
       FROM tickets t
       JOIN rounds r ON t.round_id = r.id
       WHERE t.player_address = $1
       ORDER BY t.round_id::int DESC, t.ticket_index::int ASC`,
      [address]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[GET /players/:address/tickets]", err.message);
    res.status(500).json({ error: "Failed to fetch tickets", detail: err.message });
  }
});

/**
 * @swagger
 * /players/{address}/rewards:
 *   get:
 *     summary: Get rewards and withdrawals for a player
 *     description: Returns all winning tickets and all USDC withdrawals for a wallet address.
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Player wallet address (0x...)
 *     responses:
 *       200:
 *         description: Object with earned tickets and withdrawals arrays
 */
router.get("/:address/rewards", async (req, res) => {
  const address = req.params.address.toLowerCase();
  try {
    const ticketsResult = await db.query(
      `SELECT round_id, ticket_index, numbers, matched_count, reward
       FROM tickets
       WHERE player_address = $1 AND reward IS NOT NULL
       ORDER BY round_id::int DESC`,
      [address]
    );

    const withdrawalsResult = await db.query(
      `SELECT amount, tx_hash, created_at
       FROM withdrawals
       WHERE player_address = $1
       ORDER BY created_at DESC`,
      [address]
    );

    res.json({
      earned: ticketsResult.rows,
      withdrawals: withdrawalsResult.rows,
    });
  } catch (err) {
    console.error("[GET /players/:address/rewards]", err.message);
    res.status(500).json({ error: "Failed to fetch rewards", detail: err.message });
  }
});

module.exports = router;
