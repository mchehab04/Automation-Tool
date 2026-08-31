import { formatVehicle, type VehicleDetails } from "@/lib/vehicle";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";

// Deterministic — unlike the AI-drafted pending* messages elsewhere in this
// app, a booking confirmation only needs facts already known the moment a
// lead is scheduled (name, appointment time, vehicle), not synthesis of a
// conversation. No AI call needed.
export function defaultBookingMessage(
  name: string,
  scheduledAt: Date,
  vehicle: VehicleDetails,
): string {
  const when = scheduledAt.toLocaleString("en-US", { timeZone: BUSINESS_TIMEZONE });
  return `Hi ${name}, your appointment for your ${formatVehicle(vehicle)} is confirmed for ${when}. We look forward to seeing you then — let us know if you need to reschedule.`;
}
