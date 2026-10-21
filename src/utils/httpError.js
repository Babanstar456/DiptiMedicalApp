// Error with an HTTP status whose message is safe to show to the user.
const httpError = (status, message) => Object.assign(new Error(message), { status, expose: true });

module.exports = httpError;
