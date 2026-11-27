import assert from "node:assert/strict";
import { createPurchaseSchema } from "../modules/purchases/purchases.validation.js";
assert(createPurchaseSchema.safeParse({productId:1,quantity:5,unitPrice:"19.99"}).success);
assert(!createPurchaseSchema.safeParse({productId:1,quantity:-1,unitPrice:"19.99"}).success);
