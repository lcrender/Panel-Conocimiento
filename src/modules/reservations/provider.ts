export type ReservationProviderKind =
  | "external_api"
  | "mysql"
  | "postgresql"
  | "sqlserver"
  | "custom";

export type ReservationSummary = {
  id: string;
  code: string;
  phone: string | null;
  guestName: string | null;
  status: string;
};

export type ReservationDetails = ReservationSummary & {
  data: Record<string, unknown>;
};

// Cada proyecto podrá elegir un proveedor distinto.
// Esta etapa deja el contrato y la tabla project_reservation_settings, sin conectores.
export interface ReservationProvider {
  findReservationByPhone(phone: string): Promise<ReservationSummary[]>;
  findReservationByCode(code: string): Promise<ReservationSummary | null>;
  getReservationDetails(id: string): Promise<ReservationDetails | null>;
}

export type ReservationProviderFactory = (projectId: string) => Promise<ReservationProvider>;
