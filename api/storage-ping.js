const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { s3, BUCKET } = require('./_storage');

module.exports = async (req, res) => {
  try {
    const out = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 1 }));
    res.status(200).json({ ok: true, bucket_reachable: true, objects_found: out.KeyCount || 0 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.name + ': ' + e.message });
  }
};