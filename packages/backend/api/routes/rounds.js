// rounds.js — routes for lottery round data

const express = require("express");
const db = require("../../db");

const router = express.Router();

/**
 * @swagger
 * /rounds:
 *   get:
 *     summary: Get all rounds
 *     description: Returns all lottery rounds, newest first.
 *     responses:
 *       200:
 *         description: List of rounds
 */
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM rounds ORDER BY id::int DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[GET /rounds]", err.message);
    res.status(500).json({ error: "Failed to fetch rounds", detail: err.message });
  }
});

/**
 * @swagger
 * /rounds/{id}:
 *   get:
 *     summary: Get a single round with its tickets
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Round ID
 *     responses:
 *       200:
 *         description: Round object and its tickets array
 *       404:
 *         description: Round not found
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const roundResult = await db.query(
      `SELECT * FROM rounds WHERE id = $1`,
      [id]
    );

    if (roundResult.rows.length === 0) {
      return res.status(404).json({ error: "Round not found" });
    }

    const ticketsResult = await db.query(
      `SELECT * FROM tickets WHERE round_id = $1 ORDER BY ticket_index::int ASC`,
      [id]
    );

    res.json({
      round: roundResult.rows[0],
      tickets: ticketsResult.rows,
    });
  } catch (err) {
    console.error("[GET /rounds/:id]", err.message);
    console.error("[GET /rounds/:id] full error:", err);
    res.status(500).json({ error: "Failed to fetch round", detail: String(err) });
  }
});

module.exports = router;
