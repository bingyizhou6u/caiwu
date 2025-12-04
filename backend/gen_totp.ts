import { authenticator } from 'otplib';
const secret = 'JBSWY3DPEHPK3PXP';
const token = authenticator.generate(secret);
console.log(token);
