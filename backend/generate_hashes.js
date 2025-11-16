
const bcrypt = require('bcryptjs');
const passwords = {
    'admin123': 'admin@bua.com',
    'donor123': 'donor1@bua.com',
    'shipper123': 'shipper1@bua.com',
    'shipper223': 'shipper2@bua.com',
    'recipient123': 'recipient1@bua.com'
};
const salt = bcrypt.genSaltSync(10);

console.log("--- GENERATED HASHES ---");
for (const password in passwords) {
    const hash = bcrypt.hashSync(password, salt);
    console.log(`-- For user: ${passwords[password]} (password: ${password})`);
    console.log(`-- Hash: ${hash}\n`);
}
console.log("------------------------");
