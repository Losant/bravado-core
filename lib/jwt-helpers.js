import { createSigner, createVerifier } from 'fast-jwt';

const JWT_SECRET = process.env.JWT_SECRET;

const PRIMARY_JWT_OPTIONS = {
  key: JWT_SECRET,
  algorithm: process.env.JWT_ALGO || 'EdDSA',
  iss: process.env.JWT_ISSUER
};
if (process.env.JWT_AUDIENCE) {
  PRIMARY_JWT_OPTIONS.audience = process.env.JWT_AUDIENCE;
}
const primaryVerifier = createVerifier({
  key: process.env.JWT_PUBLIC_KEY || PRIMARY_JWT_OPTIONS.key,
  algorithms: PRIMARY_JWT_OPTIONS.algorithm,
  allowedIss: PRIMARY_JWT_OPTIONS.iss
});
let secondaryVerifier;
if (process.env.JWT_SECONDARY_SECRET) {
  secondaryVerifier = createVerifier({
    key: process.env.JWT_SECONDARY_SECRET,
    algorithms: process.env.JWT_SECONDARY_ALGO,
    allowedIss: process.env.JWT_SECONDARY_ISSUER
  });
}

export const issueToken = createSigner(PRIMARY_JWT_OPTIONS);
export const verifyToken = function(token) {
  let decodedToken, err;
  try {
    decodedToken = primaryVerifier(token);
  } catch (e) {
    err = e;
  }
  if (!decodedToken &&
    secondaryVerifier &&
    (
      err.code === 'FAST_JWT_INVALID_ALGORITHM' ||
      err.code === 'FAST_JWT_INVALID_SIGNATURE'
    )
  ) {
    try {
      decodedToken = secondaryVerifier(token);
    } catch {}
  }
  if (decodedToken) {
    return decodedToken;
  }
  throw err;
};
