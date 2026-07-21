const express = require("express");
const router = express.Router();

const fetchuser = require("../middleware/fetchUser");

const { getAccountStatement } = require("../controllers/accountController");

router.get("/ledger", fetchuser, getAccountStatement);

module.exports = router;
