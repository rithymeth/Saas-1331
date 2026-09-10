import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/env";

const stripeSecretKey = getStripeSecretKey();

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
