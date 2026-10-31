import { Environment, SignedDataVerifier } from "@apple/app-store-server-library";
import roots from "./rootCertificates.json";
import { appleAppId, appleBundleId, normalizeAppleTransaction } from "./transaction";

// Apple公式CAから取得したDER証明書。秘密情報ではない。
// https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
const verifiers = [Environment.PRODUCTION, Environment.SANDBOX].map(environment =>
  new SignedDataVerifier(roots.map(root => Buffer.from(root, "base64")), true, environment, appleBundleId, appleAppId));

export async function verifyAppleTransaction(jws: string) {
  for (const verifier of verifiers) {
    try { return normalizeAppleTransaction(await verifier.verifyAndDecodeTransaction(jws)); } catch { /* 別環境を署名から検証する。 */ }
  }
  throw new Error("verification_failed");
}

export async function verifyAppleNotification(jws: string) {
  for (const verifier of verifiers) {
    try {
      const notification = await verifier.verifyAndDecodeNotification(jws);
      const signed = notification.data?.signedTransactionInfo;
      return { notification, transaction: signed ? normalizeAppleTransaction(await verifier.verifyAndDecodeTransaction(signed)) : null };
    } catch { /* 未検証のペイロードから環境を信用しない。 */ }
  }
  throw new Error("verification_failed");
}
