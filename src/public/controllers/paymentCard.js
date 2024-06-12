const axios = require('axios');
require('dotenv').config()
const { v4: uuidv4 } = require('uuid');
const idempotencyKey = uuidv4();

const processPayment = async (req, res) => {
  
}

module.exports = { processPayment }