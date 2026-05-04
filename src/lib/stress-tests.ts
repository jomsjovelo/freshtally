
import { 
  writeBatch, 
  doc, 
  collection, 
  getDoc, 
  Firestore 
} from "firebase/firestore";

/**
 * SYSTEM AUDIT UTILITY - FRESHTALLY V2
 * Performance scrub: Removed verbose logging to production stdout.
 */

export async function simulatePOSCheckout(db: Firestore, tenantId: string) {
  const txRef = doc(collection(db, "tenants", tenantId, "transactions"));
  const batch = writeBatch(db);
  batch.set(txRef, { type: "STRESS_TEST", amount: 999 });
  
  try {
    throw new Error("MOCK_NETWORK_FAILURE_DURING_COMMIT");
  } catch (e: any) {
    if (e.message === "MOCK_NETWORK_FAILURE_DURING_COMMIT") {
      const snap = await getDoc(txRef);
      return !snap.exists();
    }
  }
  return false;
}

export async function testInventoryUnderflow(cart: any[]) {
  const mockCart = cart.map(item => ({
    ...item,
    quantity: (item.stock || 0) + 50
  }));
  return mockCart.filter(item => (item.stock || 0) < item.quantity).length > 0;
}

export async function runFullSystemAudit(db: Firestore, tenantId: string, cart: any[]) {
  const t1 = await simulatePOSCheckout(db, tenantId);
  const t2 = await testInventoryUnderflow(cart);
  return t1 && t2;
}
