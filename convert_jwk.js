const crypto = require('crypto');

// Create key object with base64url strings
const keyObj = crypto.createPublicKey({
  key: {
    kty: 'RSA',
    n: '0DfPFTNYiTPDAUCu9ebHvQdoN_DRUM4_diXPu3Uh7ysGZdAiRzWgIszU_j4VB39mL3gJLon-TG5G2BqPka3tUG0YBh3LPxiJ07t8Iza_tQjLVUwoh4A2-z9eHBi7BAappp-_qOIzcH60k7pYhAtEMyO7xh2lRkpedJDoAssNh5yFwMzdc5ixkjSPXMYy_dSIQJaAK_N78uLJBXlMBXYx_hubwC96Hxrala54jAp5MJ7mB7a9zbqfZaOAHwhbHBukk2lKYWk6XK5rxj7-rmjUeQ5MHBdbB4TkuFCrd2IQ15fGOMiCkNZo7yKby3tjWM9JWR10zgW5WHmZ1ezkjZN0Bw',
    e: 'AQAB'
  },
  format: 'jwk'
});

// Export as PEM
const pem = keyObj.export({ format: 'pem', type: 'spki' });
console.log(pem);
