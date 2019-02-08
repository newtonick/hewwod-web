/***
 * Export configuration based on the environment variable
 */
module.exports = require('./env/' + process.env.NODE_ENV + '.js');