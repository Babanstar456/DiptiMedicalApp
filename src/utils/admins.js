// Emails that always get the admin role once their email is verified by Firebase.
// Override with ADMIN_EMAILS="a@x.com,b@y.com" in .env / Vercel.
const DEFAULT_ADMINS = 'digital.diptimedical@gmail.com';

function adminEmails() {
  return (process.env.ADMIN_EMAILS || DEFAULT_ADMINS)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const isAdminEmail = (email) => !!email && adminEmails().includes(email.toLowerCase());

module.exports = { adminEmails, isAdminEmail };
