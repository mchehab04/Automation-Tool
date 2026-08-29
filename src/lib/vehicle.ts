// Shared shape for the make/model/year captured at QUALIFIED — used by the
// stage-transition dialog, the server action that enforces it, and both AI
// email-intake paths that try to pre-fill it.
export type VehicleDetails = { make: string; model: string; year: string };

export function formatVehicle(vehicle: VehicleDetails): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();
}
