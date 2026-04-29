import { createSigner, createVerifier } from 'fast-jwt';
import convict from 'convict';

const jwtConf = convict({
  primary: {
    issuers: {
      doc: 'JWT issuers (all valid for verification, first used for signing)',
      format: Array,
      default: [],
      env: 'JWT_ISSUER'
    },
    secret: {
      doc: 'Private key or secret used to sign JWT',
      format: String,
      default: '',
      env: 'JWT_SECRET'
    },
    publicKey: {
      doc: 'Public Key to verify JWT when using ALGO EdDSA',
      format: String,
      default: '',
      env: 'JWT_PUBLIC_KEY'
    },
    algorithm: {
      doc: 'Algorithm used to sign JWT',
      format: String,
      default: 'EdDSA',
      env: 'JWT_ALGO'
    },
    audience: {
      doc: 'JWT audience',
      format: String,
      default: '',
      env: 'JWT_AUDIENCE'
    }
  },
  secondary: {
    issuers: {
      doc: 'JWT issuers',
      format: Array,
      default: [],
      env: 'JWT_SECONDARY_ISSUER'
    },
    secret: {
      doc: 'Public key or secret used to verify JWT',
      format: String,
      default: '',
      env: 'JWT_SECONDARY_SECRET'
    },
    algorithm: {
      doc: 'Algorithm used to sign JWT',
      format: String,
      default: '',
      env: 'JWT_SECONDARY_ALGO'
    }
  }
});

const primaryJwtOptions = jwtConf.get('primary');
const signerOptions = {
  key: primaryJwtOptions.secret,
  algorithm: primaryJwtOptions.algorithm,
  iss: primaryJwtOptions.issuers[0]
};
if (primaryJwtOptions.audience) {
  signerOptions.audience = primaryJwtOptions.audience;
}
export const issueToken = createSigner(signerOptions);

const primaryVerifier = createVerifier({
  key: primaryJwtOptions.publicKey || primaryJwtOptions.secret,
  algorithms: primaryJwtOptions.algorithm,
  allowedIss: primaryJwtOptions.issuers
});

let secondaryVerifier;
const secondaryJwtOptions = jwtConf.get('secondary');
if (secondaryJwtOptions.secret) {
  secondaryVerifier = createVerifier({
    key: secondaryJwtOptions.secret,
    algorithms: secondaryJwtOptions.algorithm,
    allowedIss: secondaryJwtOptions.issuers
  });
}

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
    } catch (e) {
      err = e;
    }
  }
  if (decodedToken) {
    return decodedToken;
  }
  throw err;
};
