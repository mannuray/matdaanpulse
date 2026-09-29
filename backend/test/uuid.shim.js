// uuid@13 ships ESM only, which Jest's CommonJS runtime cannot load.
// Tests only need v4(), so map it to Node's built-in implementation.
const { randomUUID } = require('crypto');
module.exports = { v4: () => randomUUID() };
