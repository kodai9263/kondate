export function GET() {
  const fingerprints = (process.env.ANDROID_APP_LINK_SHA256_FINGERPRINTS ?? "").split(",")
    .map(value => value.trim().toUpperCase()).filter(value => /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));
  return Response.json(fingerprints.length ? [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: "app.kyounogohan.mobile", sha256_cert_fingerprints: fingerprints },
  }] : [], { headers: { "Cache-Control": "public, max-age=3600" } });
}
