const { S3Client } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.B2_REGION,
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
  // Backblaze rejects the newer default checksum headers, so only send them when required
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

async function presignPut(bucket, key, contentType, expiresIn = 900) {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(s3, cmd, { expiresIn });
}
async function presignGet(bucket, key, expiresIn = 3600) {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
}

module.exports = { s3, BUCKET: process.env.B2_BUCKET_NAME, presignPut, presignGet };