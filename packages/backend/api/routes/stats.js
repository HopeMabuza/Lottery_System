// stats.js — aggregate stats for the lottery dashboard

const express = require("express");
const db = require("../../db");

const router = express.Router();

/**
 * @swagger
 * /stats:
 *   get:
 *     summary: Get overall lottery statistics
 *     description: Returns totals across all rounds — ticket count, unique players, prize paid out.
 *     responses:
 *       200:
 *         description: Stats object
 */
router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM rounds)                          AS total_rounds,
        (SELECT COUNT(*) FROM rounds WHERE active = true)     AS active_rounds,
        (SELECT COUNT(*) FROM tickets)                        AS total_tickets,
        (SELECT COUNT(DISTINCT player_address) FROM tickets)  AS unique_players,
        (SELECT COALESCE(SUM(amount::numeric), 0) FROM withdrawals) AS total_withdrawn
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[GET /stats]", err.message);
    res.status(500).json({ error: "Failed to fetch stats", detail: err.message });
  }
});

module.exports = router;
