import crypto from 'node:crypto';
const password=process.argv[2]; if(!password){console.error('Usage: node scripts-hash-admin.mjs "your-password"');process.exit(1)}
const salt=crypto.randomBytes(16).toString('hex'); const key=crypto.scryptSync(password,salt,32).toString('hex'); console.log(`scrypt$${salt}$${key}`);
