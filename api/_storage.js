const { S3Client, PutObjectCommand, GetObjectCommand, UploadPartCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

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

async function presignPut(bucket, key, contentType, expiresIn = 900) {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(s3, cmd, { expiresIn });
}

// A signed link for uploading ONE chunk (part) of a big video. Valid for 6 hours,
// because large uploads on slow connections can take a long time.
async function presignUploadPart(bucket, key, uploadId, partNumber, expiresIn = 21600) {
  const cmd = new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber });
  return getSignedUrl(s3, cmd, { expiresIn });
}

// Pass downloadName to make the link save the file instead of just showing it.
async function presignGet(bucket, key, expiresIn = 3600, downloadName) {
  const input = { Bucket: bucket, Key: key };
  if (downloadName) {
    input.ResponseContentDisposition = 'attachment; filename="' + String(downloadName).replace(/"/g, '') + '"';
  }
  return getSignedUrl(s3, new GetObjectCommand(input), { expiresIn });
}

module.exports = { s3, BUCKET: process.env.B2_BUCKET_NAME, presignPut, presignGet, presignUploadPart };