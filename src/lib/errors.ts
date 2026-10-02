export class DataError extends Error {
  constructor(message = "No se pudo leer los datos.") {
    super(message);
    this.name = "DataError";
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function toUserMessage(error: { message?: string; code?: string }) {
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "23505") {
    if (message.includes("clients_name")) return "Ya existe un cliente con ese nombre.";
    if (message.includes("projects_client_name")) {
      return "Ya existe un proyecto con ese nombre en este cliente.";
    }
    if (message.includes("categories_project_name")) {
      return "Ya existe una categoría con ese nombre en este proyecto.";
    }
    if (message.includes("memberships_scope")) return "Ese usuario ya tiene ese acceso.";
    if (message.includes("profiles_email")) return "Ya existe un usuario con ese email.";
    return "Ya existe un registro igual.";
  }

  if (code === "42501" || code === "PGRST301") {
    return "No tenés permiso para esta acción.";
  }

  if (code === "P0001") {
    const cleaned = message.replace(/^.*?:\s*/, "").trim();
    if (cleaned.length > 0 && cleaned.length < 180) return cleaned;
  }

  return "No se pudo completar la acción.";
}
